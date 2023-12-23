import type {AnyZodObject, ZodAny, ZodTypeAny} from "zod";
import {z, ZodDefault, ZodError, ZodObject, ZodOptional} from "zod";
import type {PureOptions} from "~/core/handler/pureHandler.ts";
import {PureHandler} from "~/core/handler/pureHandler.ts";
import type {HttpMethod} from "~/core/utils/httpMethod.ts";
import _, {isObject} from "lodash";
import {ApiError, zApiError} from "~/core/apiError.ts";
import StatusCode from "status-code-enum";
import type {PermissionsDefinition} from "~/core/permissions.ts";
import {error, info} from "~/core/utils/logger.ts";
import type {MergeZodTypes} from "~/core/utils/zod.ts";
import type {Injectable} from "~/core/inject.ts";
import type {OperationObject} from "openapi-typescript/src/types.ts";
import {getEmptyEquivalentZod} from "~/core/utils/getEmptyEquivalent.ts";
import {zodToJsonSchema} from "zod-to-json-schema";
import {ApiContext} from "~/core/handler/apiContext.ts";
import {isDev} from "~/core/utils/general.ts";
import type {Context} from "elysia";

export interface PropLocation {
    location: "header" | "query" | "body" | "param",
    label: string,
    prop: string
}

export const PropLocations = {
    header: (label?: string) => ({location: "header", label: label || "", prop: ""}) as PropLocation,
    query: (label?: string) => ({location: "query", label: label || "", prop: ""}) as PropLocation,
    body: (label?: string) => ({location: "body", label: label || "", prop: ""} as PropLocation),
    param: (label?: string) => ({location: "param", label: label || "", prop: ""} as PropLocation)
}

export type PropsLocation<ZProps extends AnyZodObject> = { [key in ZProps["shape"]]: PropLocation }

export type HandlerFunction<ZProps extends AnyZodObject, ZResponse extends AnyZodObject> = (props: z.infer<ZProps>) => Promise<z.input<ZResponse>> | z.input<ZResponse>
export type OuterHandlerFunction<ZProps extends AnyZodObject, ZResponse extends AnyZodObject> = (props: z.input<ZProps>) => Promise<z.infer<ZResponse>> | z.infer<ZResponse>
export type InjectList = { [k: string]: Injectable }
export type Dependencies<Inject extends InjectList> = Inject extends never
    ? any
    : {
        [Key in keyof Inject]: PrepareReturn<Inject[Key]["zProps"], Inject[Key]["zResponse"]>
    }


export type HandlerFunctionDefinition<
    ZProps extends AnyZodObject,
    ZResponse extends AnyZodObject,
    TInjects extends Record<string, any>> =
    (props: z.infer<ZProps>, injects: TInjects)
        => Promise<z.input<ZResponse>> | z.input<ZResponse>

export type GetPropLocations<ZProps extends AnyZodObject> = (propLocations: typeof PropLocations) => Record<keyof ZProps["shape"], PropLocation>


/**
 * @deprecated
 */
export type HandlerExport<ZProps extends AnyZodObject, ZResponse extends AnyZodObject> = {
    method: HttpMethod,
    url: string,
    zProps: ZProps,
    zResponse: ZResponse,
    getPropLocations: GetPropLocations<ZProps>,
    permissions: PermissionsDefinition,
    handler: HandlerFunction<ZProps, ZResponse>,
    options?: PureOptions
}

export type MergeObjectAugmentation<X extends AnyZodObject, Y extends AnyZodObject | undefined> = Y extends AnyZodObject ? MergeZodTypes<X["shape"], Y, Y["shape"]> : X

/**
 * @deprecated
 */
export type HandlerAugmentation<ZProps extends AnyZodObject, ZResponse extends AnyZodObject, AugZProps extends AnyZodObject | undefined, AugZResponse extends AnyZodObject | undefined> =
    {
        // simple
        x: () => AugZProps extends AnyZodObject ? z.infer<AugZProps> : number,
        method?: HttpMethod,
        url?: string,
        options?: PureOptions
        permissions?: PermissionsDefinition,
        // dynamic
        zResponse?: AugZResponse
        handler?: HandlerFunction<
            MergeObjectAugmentation<ZProps, AugZProps>,
            MergeObjectAugmentation<ZResponse, AugZResponse>
        >
    }
    // props must be provided with appropriate locations
    & (AugZProps extends AnyZodObject ? {
    zProps: AugZProps
    getPropLocations: GetPropLocations<AugZProps>
} : {
    zProps?: undefined
    getPropLocations?: undefined
})

export type PrepareReturn<T extends AnyZodObject, Y extends AnyZodObject> = {
    asSuper: OuterHandlerFunction<T, Y>,
    asOriginal: OuterHandlerFunction<T, Y>,
}

/**
 * High-end network access, recommended
 * TODO: remake injections to dependencies, so typescript won't bitch about referencing in its own initializer
 */
export class Handler<
    ZProps extends AnyZodObject,
    ZResponse extends AnyZodObject,
    Injections extends InjectList
>
    extends PureHandler<Injections> {
    readonly propsLocation: PropsLocation<ZProps>;

    /**
     *
     * @param method
     * @param url relative url to handler example: /:id/_update
     * @param zProps zod object, that represents handlers parameters
     * @param zResponse zod object, that represents return type of the handler
     * @param getPropLocations mapping request parameters to props
     * @param permissions read permissions.md
     * @param handler the main handler function
     * @param getInjections handlers or services you wish to inject
     * @param options
     */
    constructor(
        method: HttpMethod,
        url: string,
        public zProps: ZProps,
        public zResponse: ZResponse,
        getPropLocations: GetPropLocations<ZProps>,
        permissions: PermissionsDefinition,
        public handler: HandlerFunctionDefinition<ZProps, ZResponse, Dependencies<Injections>>,
        getInjections?: Injections | (() => (Injections | Promise<Injections>)),
        options?: Partial<PureOptions>,
    ) {

        super(method, url, permissions, async (ctx) => {
            try {
                const props = await this.transformProps(ctx)
                const context = await ApiContext.init(ctx)
                const handler = this.prepare(context).asOriginal
                const response = this.zResponse.safeParse(await handler(props))

                if (!response.success) {
                    return new ApiError(500, "servers response is malformed", "zod", response.error).response()
                }

                const query = new Map(ctx.request.url.split("?").pop()?.split("&").map(i => i.split("=")) as Iterable<[unknown, unknown]>)

                const pretty = (query.has("pretty") ? query.get("pretty") !== "false" : ctx.headers["User-Agent"]?.includes("Mozilla"))
                return new Response(JSON.stringify({
                    ...response.data,
                    error: false
                }, null, pretty ? 2 : 0), {headers: {"Content-Type": "application/json"}})
                // return Response.json({...response.data, error: false})
            } catch (e) {
                if (e instanceof ApiError) {
                    return e.response()
                }

                error(e)
                return new ApiError(500, "unexpected server error").response()
            }
        }, {
            ...options,
            schema: {}
        }, getInjections)

        this.makePropsCoerce(this.zProps, true)
        this.propsLocation = getPropLocations(PropLocations);
        _.forIn(this.propsLocation, (value, key) => {
            value.prop = key

            if (value.label === "" && value.location !== "body") value.label = value.prop
        })

        this.options.schema = options?.schema ? options.schema : Handler.generateOpenApiSchema(url, method, this.zProps, this.zResponse, this.propsLocation, this.options, this.id)

        this.options.schema.tags ??= []
        const tag = this.permissions.prefix?.split(".").map(i => _.upperFirst(i)).join("/")

        if (isDev) info(tag?.toLowerCase() + this.path)

        if (tag) this.options.schema.tags.push(tag)
    }

    /**
     * @throws {ApiError}
     * @param ctx
     */
    async transformProps(ctx: Context): Promise<z.infer<ZProps>> {
        try {
            const props: {
                [key: string]: unknown
            } = {}
            const query = new Map(ctx.request.url.split("?").pop()?.split("&").map(i => i.split("=")) as Iterable<[unknown, unknown]>)

            const body = await (async function () {
                try {
                    return await ctx.body
                } catch (e) {
                    return {}
                }
            })()
            _.forIn(this.propsLocation, (value, key) => {
                switch (value.location) {
                    case "header": {
                        props[key] = ctx.headers[value.label]
                        break
                    }
                    case "query": {
                        /**
                         * @deprecated
                         */
                        // console.log(this.zProps.shape[value.prop])
                        // console.log((z.string()).default("aaa").optional().unwrap())
                        // if (this.zProps.shape[value.prop] instanceof ZodNumber) props[key] = Number(query.get(value.label))
                        // else if (this.zProps.shape[value.prop] instanceof ZodBoolean) props[key] = Boolean(query.get(value.label))
                        // else props[key] = query.get(value.label)
                        props[key] = query.get(value.label)

                        break
                    }
                    case "body": {
                        props[key] = (value.label === "") ? body : _.get(body, value.label)

                        break
                    }
                    case "param": {
                        if (!isObject(ctx.params)) return;
                        if (!_.has(ctx.params, value.label)) return

                        /**
                         * @deprecated
                         */
                        // if (this.zProps.shape[value.prop] instanceof ZodNumber) {
                        //     props[key] = Number(ctx.params[value.label])
                        // } else if (this.zProps.shape[value.prop] instanceof ZodBoolean) {
                        //     props[key] = Boolean(ctx.params[value.label])
                        // } else {
                        //     props[key] = (ctx.params as Record<string, string>)[value.label]
                        // }

                        // coerce will handle it
                        props[key] = ctx.params[value.label]
                        break
                    }

                }
            })

            return this.zProps.parse(props)
        } catch (e) {
            if (e instanceof ZodError) {
                throw new ApiError(StatusCode.ClientErrorBadRequest, "props are invalid", "zod", e)
            }
            console.log(e)
            throw new ApiError(StatusCode.ServerErrorInternal, "something went wrong while processing props", "unknown", e)
        }

    }

    /**
     * @deprecated
     * @param props
     */
    public async run(props: z.input<ZProps>): Promise<z.infer<ZResponse>> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return this.zResponse.parse(await this.handler(this.zProps.parse(props)))
    }

    /**
     * // TODO: make use of url and method -> path
     * @param url with /:id type params
     * @param method
     * @param zProps
     * @param zResponse
     * @param propLocation
     * @param options
     * @param id of handler
     */
    static generateOpenApiSchema(url: string, method: string, zProps: AnyZodObject, zResponse: AnyZodObject, propLocation: PropsLocation<AnyZodObject>, options: PureOptions, id?: string): OperationObject {
        let zBody = z.object({})

        for (const shapeKey in zProps.shape) {
            if (propLocation[shapeKey].location === "body") {
                if (propLocation[shapeKey].label === "") {
                    zBody = zProps.shape[shapeKey]
                } else {
                    zBody = zBody.merge(z.object({
                        [propLocation[shapeKey].label]: zProps.shape[shapeKey]
                    }))
                }
            }
        }

        return {
            description: `${id && "<a href='/v1/core/handler/" + id + "/paw'>paw</a>"} ${options.description || ""}`,
            summary: options.summary || "",
            tags: options.tags,
            responses: {
                "200": {
                    description: "success",
                    "content": {
                        "application/json": {
                            "schema": zodToJsonSchema(zResponse)
                        }
                    },
                },
                "500": {
                    description: "error",
                    "content": {
                        "application/json": {
                            "schema": zodToJsonSchema(zApiError)
                        }
                    },
                }
            },
            parameters: Object.entries(zProps.shape).map(([k, v]) => {
                if (propLocation[k].location === "body") {
                    return undefined as any
                }

                return {
                    in: propLocation[k].location === "param" ? "path" : propLocation[k].location,
                    schema: zodToJsonSchema(v as ZodAny),
                    name: k,
                    required: !(v as ZodAny).isOptional()
                }
            }).filter(i => i),
            requestBody: {
                content: {
                    "application/json": {
                        schema: zodToJsonSchema(zBody)
                    }
                }
            }
        } satisfies OperationObject
    }

    /**
     * @param handler
     * @param path
     */
    static generateCurlRequest(handler: AnyHandler, path: string): string {
        let curl = `curl -X ${handler.method}`
        let url = Bun.env.HOST + path
        let body: Record<string, unknown> = {}
        /**
         * param
         */

        for (const key in handler.zProps.shape) {
            const field = handler.zProps.shape[key]

            if (handler.propsLocation[key].location === "header") {
                curl += ` \\\n-H "${handler.propsLocation[key].label}: ${getEmptyEquivalentZod(field)}"`
            }

            if (handler.propsLocation[key].location === "param") {
                url = url.replace(":" + handler.propsLocation[key].label, String(getEmptyEquivalentZod(field)))
            }

            if (handler.propsLocation[key].location === "query") {
                if (!url.endsWith("?")) url += "?"
                url += `${handler.propsLocation[key].label}=${encodeURIComponent(getEmptyEquivalentZod(field) as never)}&`
            }

            if (handler.propsLocation[key].location === "body") {
                if (handler.propsLocation[key].label === "") {
                    body = getEmptyEquivalentZod(field) as Record<string, unknown>
                } else {
                    body[handler.propsLocation[key].label] = getEmptyEquivalentZod(field)
                }
            }
        }

        if (Object.keys(body).length) {
            curl += " \\\n-H 'Content-Type: application/json'"
            curl += ` \\\n-d '${JSON.stringify(body)}'`
        }

        if (url.endsWith("&")) url = url.substring(0, url.length - 1)

        curl += " " + url
        return curl
    }

    makePropsCoerce(zType: ZodTypeAny, val: boolean = true) {
        if (zType instanceof ZodObject) {
            _.forIn(zType.shape, (value) => {
                this.makePropsCoerce(value, val)
            })
            return;
        }

        if ("coerce" in zType._def) {
            zType._def.coerce = val
            return
        }

        if (zType instanceof ZodDefault) {
            this.makePropsCoerce(zType._def.innerType, val)
        }
        if (zType instanceof ZodOptional) {
            this.makePropsCoerce(zType._def.innerType, val)
        }
    }

    prepare(ctx: ApiContext): PrepareReturn<ZProps, ZResponse> {

        const run = async (props: z.input<ZProps>, context: ApiContext) => {
            const injections = await this.getInjections()

            const dependencies: Partial<Dependencies<Injections>> = {}

            for (const key in injections) {
                // It works, so leave it like that
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                dependencies[key] = injections[key].prepare(context)
            }

            return this.zResponse.parse(await this.handler(
                this.zProps.parse(props),
                dependencies as Dependencies<Injections>
            ))
        }

        return {
            asSuper(props) {
                return run(props, ApiContext.superUser())
            },
            asOriginal(props) {
                return run(props, ctx)
            }
        }
    }

    /**
     * Prints http link to paw redirect into console
     * Use only in development
     */
    paw(): void {
        console.log(`http://0.0.0.0:3000/v1/core/handler/${this.id}/paw`)
    }

    export() {
        return {
            ...super.export(),
            propLocation: this.propsLocation,
            props: zodToJsonSchema(this.zProps),
            response: zodToJsonSchema(this.zResponse),
        }
    }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHandler = Handler<any, any, any>