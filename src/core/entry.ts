import * as path from "path";
import {Handler as LaeticiaHandler} from "~/core/handler/handler.ts";
import {PureHandler} from "~/core/handler/pureHandler.ts";
import {readDirRecursive} from "~/core/utils/readDirRecursive.ts";
import {error, info, warn} from "~/core/utils/logger.ts";
import {generateHeapSnapshot} from "bun";
import {redis} from "~/core/provider/redis.ts";
import {heapStats} from "bun:jsc";
import {randomId} from "~/core/utils/randomId.ts";
import {generateDocs} from "~/core/loaders/docs.ts";
import {generatePermissionsFile} from "~/core/loaders/permissions.ts";
import Elysia from "elysia";
import {html} from "@elysiajs/html";
import {censor} from "~/core/utils/censor.ts";
import {Resource} from "~/core/handler/resource.ts";
import {isDev} from "~/core/utils/general.ts";
import {defer} from "~/core/utils/defer.ts";
import {elasticsearch} from "~/core/provider/elasticsearch.ts";

export async function core() {
    const start = Bun.nanoseconds()
    const notSetEnv = [
        "ELASTIC_USER",
        "ELASTIC_PASSWORD",
        "ELASTIC_USER",
        "CORE_ENDPOINTS_DIR",
        "PATH_TO_PROJECT"
    ].map((i) => {
        if (!Bun.env[i]) return i
    }).filter(i => i)

    if (notSetEnv.length) {
        throw new Error(`undefined environment variables: ${notSetEnv.join(", ")}`)
    }

    if (!Bun.env.CORE_ENDPOINTS_DIR) throw new Error("environment variable CORE_ENDPOINTS_DIR is undefined");

    elasticsearch.search({}).then(({error} )=>{
        if (error?.name === "ConnectionRefused") {
            throw new Error("Elasticsearch refused connection")
        }
    })


    const port = Number(Bun.env.PORT) || 3000
    const version = (await Bun.file(path.join(import.meta.dir, "../../package.json")).json()).version
    const startId = randomId(10)

    const moduleObjects: {
        path: string,
        module: object
    }[] = []
    const permissions: string[] = []

    for (const dir of await readDirRecursive(Bun.env.CORE_ENDPOINTS_DIR)) {
        moduleObjects.push({
            path: dir,
            module: await import(path.join(<string>Bun.env.CORE_ENDPOINTS_DIR, dir))
        })
    }

    const app = new Elysia()
        .use(html())
        .onError((context) => {
            if (context.code === 'NOT_FOUND') return ({
                error: true,
                message: "route not found",
                status: 404
            })
            console.log(context)
            error(context.error)

            return ({
                error: true,
                message: "Unknown error",
                status: 500
            })
        })
        .onRequest((ctx) => {
            // const start = Bun.nanoseconds()
            // id:${ctx.requestID}
            info(`${ctx.request.method} ${ctx.request.url} ses:${censor(ctx.request.headers.get("authorization") || "")}`)
        })
        // .onResponse((ctx) => {
        //     const start = requestsMap.get(ctx.requestID) || 0
        //     info(`id:${ctx.requestID} took:${Math.floor((Bun.nanoseconds() - start) / 10000) / 100}ms`)
        // })
        .onStart(() => info(`Server started at http://0.0.0.0:${port} in ${Math.round((Bun.nanoseconds() - start)/1000000)} ms`))

    const v1Group = new Elysia({prefix: "/v1"})

    const pureHandlers: Map<string, { handler: PureHandler<any>, path: string, key: string }> = new Map
    const handlers: Map<string, { handler: LaeticiaHandler<any, any, any>, path: string }> = new Map
    const resourcesMap = new Map<string, Resource<any>>

    for (const moduleObject of moduleObjects) {
        let found = false

        for (const [key, exportedValue] of Object.entries(moduleObject.module)) {
            if (exportedValue instanceof PureHandler) {
                pureHandlers.set(exportedValue.id, {
                    key: key,
                    handler: exportedValue,
                    path: path.join("/", path.parse(moduleObject.path).dir, path.parse(moduleObject.path).name, exportedValue.path),
                })

                permissions.push(...exportedValue.permissions.required)
                permissions.push(...exportedValue.permissions.optional)

                found = true
            }

            if (exportedValue instanceof LaeticiaHandler) {
                handlers.set(exportedValue.id, {
                    handler: exportedValue,
                    path: moduleObject.path
                })
            }

            if (exportedValue instanceof Resource) {
                if (resourcesMap.has(key)) warn(`Multiple instances of Resource with name "${key}", this will lead to errors`)

                resourcesMap.set(key, exportedValue)
            }
        }

        if (!found) warn(`Module "${moduleObject.path}" does not export any handler`)
    }

    let nOfDependencies = 0

    // Load connections across resources
    resourcesMap.forEach((value, key) => {
        value.getDependencies().forEach(i => {
            const resource = resourcesMap.get(i.resourceId)
            if (!resource) return warn(`Referencing unknown resource "${i.resourceId}" in "${key}" resource`)
            resource.addDependent(value, i)
            nOfDependencies++
        })
    })

    info(`Successfully mounted ${nOfDependencies} dependencies`)

    // Get Dependencies
    // resourcesMap.forEach(value => {
    //     // @ts-ignore
    //     console.log(value.index.uid, Array.from(value.dependentsSet.values()).map(i =>[i.resource.index.uid, i.field]))
    // })

    const elysiaHandlers = (v1Group as unknown as {
        // [k: string]: (path: string, handler: Handler, options: RouteOptions) => Elysia
        [k: string]: typeof app.post
    })

    for (const handler of pureHandlers.values()) {
        elysiaHandlers[handler.handler.method.toLowerCase()](
            handler.path,
            (context) => {
                return handler.handler._handler(context)
            }
        );

    }

    await generateDocs(pureHandlers, version)

    await generatePermissionsFile(permissions)


    v1Group.get("/core/health", async () => {
        // TODO: Elastic health
        let redisHealthy = false
        try {
            const redisStatus = await redis.ping()

            if (redisStatus) redisHealthy = true
        } catch (e) {
            redisHealthy = false
        }
        const heap = heapStats()
        return Response.json({
            redis: redisHealthy,
            healthy: redisHealthy,
            heap: `${Math.round(heap.heapSize / 8 / 1024 / 1024 * 100) / 100} MB`,
            objects: heap.objectCount
        })
    })
    v1Group.get("/docs", () => Bun.file(import.meta.dir + "/docs/index.html").text())
    v1Group.get("/docs/definition", () => Bun.file(import.meta.dir + "/generated/open-api.json").json())
    v1Group.all("/core/handler/:id/paw", (ctx) => {
        const handler = pureHandlers.get(ctx.params.id)

        if (handler?.handler instanceof LaeticiaHandler) {
            return Response.redirect(`paw://current.document/open?text=${encodeURIComponent(LaeticiaHandler.generateCurlRequest(handler.handler, "/v1" + handler.path))}&importer=com.luckymarmot.PawExtensions.cURLImporter`, 307)
        }

        return Response.json({
            error: true,
            message: "handler not found",
            status: 404
        }, {status: 404})

    })

    v1Group.get("/core/handler/:id", (ctx) => {
        const handler = pureHandlers.get(ctx.params.id)

        if (handler) {
            return Response.json({
                ...handler.handler.export(),
                key: handler.key
            })
        }

        return Response.json({
            error: true,
            message: "handler not found",
            status: 404
        }, {status: 404})

    })
    v1Group.get("/core/handler", () => Array.from(handlers).map(i => i[1].handler.id))

    app.use(v1Group)

    app.get("/", () => ({
        version,
        startId
    }))

    app.get("/v1/core/heap", () => generateHeapSnapshot())

    app.listen(port)

    defer(async () => {
        if (isDev) {
            try {
                const response = await fetch("http://localhost:3777/reload", {
                    method: "POST",
                })

                if ((response.status - 200) < 100) {
                    info(`Reloaded client server`)
                }
            } catch (e) {
                warn(`No client server was found`)
            }
        }
    })


    return app
}

