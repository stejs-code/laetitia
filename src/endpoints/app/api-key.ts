import {
    dependency,
    Resource,
    zPropsCreateFactory, zPropsDeleteFactory,
    zPropsGetFactory, zPropsSearchFactory, zPropsUpdateFactory, zResponseDeleteFactory,
    zResponseGetFactory, zResponseSearchFactory, zResponseUpdateFactory
} from "~/core/handler/resource.ts";
import {z} from "zod";
import {permissionsZod} from "~/core/generated/permissions.ts";
import {Handler} from "~/core/handler/handler.ts";

export const apiKeyZod = z.object({
    id: z.string(),
    author: z.object({
        id: z.number(),
        name: z.string()
    }),
    permissions: permissionsZod,
    expiresAt: z.coerce.date()
})

export type ApiKey = z.infer<typeof apiKeyZod>

export const apiKey = new Resource(
    apiKeyZod,
    {
        name: "api-key",
        filterableAttributes: ["author.id"]
    },
    {
        dependantFields: {
            author: dependency("user", ({id, name}) => ({id, name}))
        }
    }
)

export const getApiKey = new Handler(
    "GET",
    "/:id",
    zPropsGetFactory(apiKeyZod),
    zResponseGetFactory(apiKeyZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "get",
    apiKey.get,
)

export const searchApiKey = new Handler(
    "POST",
    "/_search",
    zPropsSearchFactory(),
    zResponseSearchFactory(apiKeyZod),
    ({query, body}) => ({
        limit: query("l"),
        offset: query("o"),
        query: query("q"),
        sort: body("sort"),
        filter: body("filter")
    }),
    "get",
    apiKey.search
)


export const createApiKey = new Handler(
    "POST",
    "/",
    zPropsCreateFactory(apiKeyZod.merge(z.object({
        expiresAt: apiKeyZod.shape.expiresAt.optional()
    }))),
    zResponseUpdateFactory(apiKeyZod),
    ({body}) => ({
        data: body()
    }),
    "create",
    (props) => {
        return apiKey.create({
            ...props,
            data: {
                ...props.data,
                expiresAt: props.data.expiresAt || new Date(new Date().getTime() + 86400000) // + 1 day
            }
        })
    }
)
export const updateApiKey = new Handler(
    "POST",
    "/:id",
    zPropsUpdateFactory(apiKeyZod),
    zResponseUpdateFactory(apiKeyZod),
    ({body, param}) => ({
        data: body(),
        id: param()
    }),
    ["update", "create"],
    apiKey.update
)

export const deleteApiKey = new Handler(
    "DELETE",
    "/:id",
    zPropsDeleteFactory(apiKeyZod),
    zResponseDeleteFactory(apiKeyZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "delete",
    apiKey.delete
)