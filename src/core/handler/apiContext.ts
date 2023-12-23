import {ApiError} from "~/core/apiError.ts";
import StatusCode from "status-code-enum";
import {meilisearch} from "~/core/provider/meilisearch.ts";
import {getIndexName} from "~/core/utils/getIndexName.ts";
import {allTruePermissions, PermissionsType, permissionsZod} from "~/core/generated/permissions.ts";
import {error} from "~/core/utils/logger.ts";
import type {Context} from "elysia";

export type LoginMethod = "api-key" | "master-key" | "super-user"

/**
 * ! BE VERY careful with import loop!!!
 */
export class ApiContext {

    constructor(
        public bearer: string,
        public method: LoginMethod,
        public permissions: PermissionsType) {
    }

    public hasPermission(path: string | string[]): boolean {
        if (typeof path === "string") {
            return this.permissions[path as keyof PermissionsType]
        }

        for (const key of path) {
            if (!this.permissions[key as keyof PermissionsType]) return false
        }

        return true
    }

    /**
     * @throws ApiError unauthorized
     * @param ctx
     */
    static async init(ctx: Context): Promise<ApiContext> {
        if (!ctx.headers.authorization) throw new ApiError(StatusCode.ClientErrorUnauthorized, "missing authorization header")

        try {

            const id = ctx.headers.authorization.slice(7) || ""

            if (id === Bun.env.API_MASTER_KEY) {
                return new ApiContext(id, "master-key", allTruePermissions)
            }

            const key = await meilisearch.index(getIndexName("api-key")).getDocument(id)

            if (new Date(key.expiresAt).getTime() < new Date().getTime()) {
                throw new ApiError(StatusCode.ClientErrorUnauthorized, "api key has expired")
            }

            return new ApiContext(key.id, "api-key", permissionsZod.parse(key.permissions))
        } catch (e) {
            if (e instanceof ApiError) throw e

            error(e)
            throw new ApiError(StatusCode.ClientErrorUnauthorized, "unauthorized")
        }
    }

    static superUser() {
        return new ApiContext("master", "super-user", allTruePermissions)
    }

}