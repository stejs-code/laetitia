import * as path from "path";
import {Handler as LaeticiaHandler} from "~/core/handler/handler.ts";
import {PureHandler} from "~/core/handler/pureHandler.ts";
import {readDirRecursive} from "~/core/utils/readDirRecursive.ts";
import {html} from "@stricjs/utils";
import {meilisearch} from "~/core/provider/meilisearch.ts";
import {warn} from "~/core/utils/logger.ts";
import {generateHeapSnapshot} from "bun";
import type {Handler} from "@stricjs/router";
import {Group, Router} from "@stricjs/router";
import type {RouteOptions} from "@stricjs/router/types/core/types";
import {redis} from "~/core/provider/redis.ts";
import {heapStats} from "bun:jsc";
import {randomId} from "~/core/utils/randomId.ts";
import {generateDocs} from "~/core/loaders/docs.ts";
import {generatePermissionsFile} from "~/core/loaders/permissions.ts";


export async function core() {
    const notSetEnv = [
        "MEILI_MASTER_KEY",
        "CORE_ENDPOINTS_DIR",
        "PATH_TO_PROJECT"
    ].map((i) => {
        if (!Bun.env[i]) return i
    }).filter(i => i)

    if (notSetEnv.length) {
        throw new Error(`undefined environment variables: ${notSetEnv.join(", ")}`)
    }

    if (!Bun.env.CORE_ENDPOINTS_DIR) throw new Error("environment variable CORE_ENDPOINTS_DIR is undefined");
    if (!(await meilisearch.isHealthy())) {
        throw new Error("meilisearch is not healthy")
    }

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

    const router = new Router({
        development: Bun.env.ENVIROMENT === "development",
        port: Number(Bun.env.PORT) || 3000,
        hostname: "0.0.0.0",

    })


    const v1Group = new Group("/v1/")

    const pureHandlers: Map<string, { handler: PureHandler<any>, path: string }> = new Map
    const handlers: Map<string, { handler: LaeticiaHandler<any, any, any>, path: string }> = new Map

    for (const moduleObject of moduleObjects) {
        let found = false

        for (const [, exportedValue] of Object.entries(moduleObject.module)) {
            if (exportedValue instanceof PureHandler) {
                pureHandlers.set(exportedValue.id, {
                    handler: exportedValue,
                    path: path.join("/", path.parse(moduleObject.path).dir, path.parse(moduleObject.path).name, exportedValue.url),
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
        }

        if (!found) warn(`Module "${moduleObject.path}" does not export any handler`)
    }

    // console.log(Bun.inspect(openApi, {depth: 8}))

    const stricHandlers = (v1Group as unknown as {
        [k: string]: (path: string, handler: Handler, options: RouteOptions) => Router
    })

    for (const handler of pureHandlers.values()) {
        stricHandlers[handler.handler.method.toLowerCase()](
            handler.path,
            (ctx, meta) => {
                return handler.handler._handler(ctx, meta)
            }, handler.handler.options
        );

    }

    await generateDocs(pureHandlers, version)

    await generatePermissionsFile(permissions)


    v1Group.get("/core/health", async () => {
        const meili = await meilisearch.isHealthy()
        let redisHealthy = false
        try {
            const redisStatus = await redis.ping()

            if (redisStatus) redisHealthy = true
        } catch (e) {
            redisHealthy = false
        }
        const heap = heapStats()
        return Response.json({
            meilisearch: meili,
            redis: redisHealthy,
            healthy: meili && redisHealthy,
            heap: `${Math.round(heap.heapSize / 8 / 1024 / 1024 * 100) / 100} MB`,
            objects: heap.objectCount
        })
    })
    v1Group.get("/docs/*", async () => html(await Bun.file(import.meta.dir + "/docs/index.html").text()))
    v1Group.get("/docs/definition", async () => Response.json(await Bun.file(import.meta.dir + "/generated/open-api.json").json()))
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
            return Response.json(handler.handler)
        }

        return Response.json({
            error: true,
            message: "handler not found",
            status: 404
        }, {status: 404})

    })
    v1Group.get("/core/handler", () => Response.json(Array.from(handlers).map(i => i[1].handler.id)))

    router.plug(v1Group)

    router.alias("/v1/docs", "/v1/docs/*")

    router.get("/", () => Response.json({
        version,
        startId
    }), {})

    router.use(404, () => Response.json({
        error: true,
        message: "route not found",
        status: 404
    }))

    router.get("/v1/core/heap", () => Response.json(generateHeapSnapshot()))


    return router
}

