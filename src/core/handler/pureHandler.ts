import type {Handler} from "@stricjs/router";
import type {HttpMethod} from "~/core/utils/httpMethod.ts";
import type {PermissionsDefinition} from "~/core/permissions.ts";
import {Permissions} from "~/core/permissions.ts";
import {ApiContext} from "~/core/handler/apiContext.ts";
import {ApiError} from "~/core/apiError.ts";
import {info} from "~/core/utils/logger.ts";
import {censor} from "~/core/utils/censor.ts";
import type {RouteOptions} from "@stricjs/router/types/core/types";
import type {Injectable} from "~/core/inject.ts";
import type {OperationObject} from "openapi-typescript/src/types.ts";
import {randomId} from "~/core/utils/randomId.ts";

export interface PureOptions extends RouteOptions {
    summary?: string,
    description?: string,
    tags?: string[],
    schema: OperationObject,
}

/**
 * Low-end access to network, untyped
 */
export class PureHandler<Injections extends { [k: string]: Injectable }> {
    /**
     * Base64 encoded method+url
     */
    id: string
    /**
     * Relative path to handler
     */
    url: string;
    /**
     * Method
     * e. g. GET, POST, ...
     */
    method: HttpMethod;
    /**
     * Already prefixed Permissions object
     */
    permissions: Permissions;
    _handler: Handler
    description: string
    /**
     * Gets injections list for this handler
     */
    getInjections: () => (Injections | Promise<Injections>)

    constructor(
        method: HttpMethod,
        url: string,
        permissions: PermissionsDefinition,
        handler: Handler,
        public options: PureOptions,
        getInjections: Injections | (() => (Injections | Promise<Injections>)) = {} as Injections,
    ) {
        this.getInjections = typeof getInjections === "function" ? getInjections : () => getInjections

        const permissionPrefix = new Error()
            .stack
            ?.split("\n")
            .reverse()
            .find(val => val.includes("/endpoints/"))
            ?.slice(0, -1)
            .split("(")
            .pop()
            ?.split(":")[0]
            ?.substring((Bun.env.CORE_ENDPOINTS_DIR?.length || 0) + 1)
            .split(".")[0]
            ?.split("/")
            .join(".") as string

        this.description = options.description || ""

        this.method = method;
        this.url = url;

        this.options.schema.tags ??= []
        this.options.schema.tags.push(permissionPrefix.replaceAll(".", "/"))

        this.permissions = new Permissions(permissions, permissionPrefix);

        this.id = "ph-" + btoa(this.method + ":" + permissionPrefix.replaceAll(".", "/") + this.url)

        this._handler = async (ctx, meta) => {
            const start = Bun.nanoseconds()
            const id = randomId(10)
            try {

                info(`${ctx.method} ${ctx.url} id:${id} ses:${censor(ctx.headers.get("Authorization") || "")}`)
                const context = await ApiContext.init(ctx)


                if (!context.hasPermission(this.permissions.required)) {
                    info(`id:${id} took:${Math.floor((Bun.nanoseconds() - start) / 10000) / 100}ms err:true`)
                    return new ApiError(401, `missing permissions: ${this.permissions.required.join(", ")}`).response()
                }

                const response = await handler(ctx, meta)

                info(`id:${id} took:${Math.floor((Bun.nanoseconds() - start) / 10000) / 100}ms err:false`)

                return response
            } catch (e) {
                info(`id:${id} took:${Math.floor((Bun.nanoseconds() - start) / 10000) / 100}ms err:true`)
                if (e instanceof ApiError) return e.response()

                return new ApiError(500, "unexpected server error").response()
            }
        }

    }

}