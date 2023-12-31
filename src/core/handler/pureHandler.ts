import type {HttpMethod} from "~/core/utils/httpMethod.ts";
import type {PermissionsDefinition} from "~/core/permissions.ts";
import {Permissions} from "~/core/permissions.ts";
import {ApiContext} from "~/core/handler/apiContext.ts";
import {ApiError} from "~/core/apiError.ts";
import type {Injectable} from "~/core/inject.ts";
import type {OperationObject} from "openapi-typescript/src/types.ts";
import type {Handler} from "elysia";
import * as path from "path"

// extends RouteOptions
export interface PureOptions {
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
    path: string;

    /**
     * final url
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

        const absolutePath = new Error()
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
            ?.split("/") as string[]

        this.description = options.description || ""

        this.method = method;
        this.path = url;

        // to remove trailing slashes
        this.url = path.join("/", absolutePath.join("/"), url).replace(/\/$/, "")
        this.options.schema.tags ??= []
        this.options.schema.tags.push(absolutePath.join("/"))

        this.permissions = new Permissions(permissions, absolutePath.join("."));

        this.id = "ph-" + btoa(this.method + ":" + this.url)

        this._handler = async (ctx) => {
            try {

                const context = await ApiContext.init(ctx)

                if (!context.hasPermission(this.permissions.required)) {
                    return new ApiError(401, `missing permissions: ${this.permissions.required.join(", ")}`).response()
                }

                return await handler(ctx)
            } catch (e) {
                if (e instanceof ApiError) return e.response()

                return new ApiError(500, "unexpected server error").response()
            }
        }

    }

    export() {
        return {
            id: this.id,
            method: this.method,
            url: this.url,
            permissions: this.permissions,
            description: this.description
        }
    }

}