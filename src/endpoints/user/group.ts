import {
    dependency,
    Resource,
    zPropsCreateFactory,
    zPropsDeleteFactory,
    zPropsGetFactory,
    zPropsSearchFactory,
    zPropsUpdateFactory,
    zResponseDeleteFactory,
    zResponseGetFactory,
    zResponseSearchFactory,
    zResponseUpdateFactory
} from "~/core/handler/resource.ts";
import {z} from "zod";
import {Handler} from "~/core/handler/handler.ts";
import {permissionsZod} from "~/core/generated/permissions.ts";
import {ServerFunction} from "~/core/handler/function.ts";

export const userGroupZod = z.object({
    id: z.number(),
    name: z.string(),
    author: z.object({
        id: z.number(),
        name: z.string()
    }).nullish(),
    permissions: permissionsZod
})

export type UserGroup = z.infer<typeof userGroupZod>

export const userGroup = new Resource(
    userGroupZod,
    {
        name: "user-group",
        filterableAttributes: []
    },
    {
        dependantFields: {
            author: dependency("user", ({id, name}) => ({
                id: id,
                name: name
            }))
        },
        onUpdate: new ServerFunction((props) => {
            return props.next(props)
        })
    }
)

export const getUserGroup = new Handler(
    "GET",
    "/:id",
    zPropsGetFactory(userGroupZod),
    zResponseGetFactory(userGroupZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "get",
    userGroup.get
)

export const searchUserGroup = new Handler(
    "POST",
    "/_search",
    zPropsSearchFactory(),
    zResponseSearchFactory(userGroupZod),
    ({query, body}) => ({
        limit: query("l"),
        offset: query("o"),
        query: query("q"),
        sort: body("sort"),
        filter: body("filter")
    }),
    "get",
    userGroup.search
)


export const createUserGroup = new Handler(
    "POST",
    "/",
    zPropsCreateFactory(userGroupZod),
    zResponseUpdateFactory(userGroupZod),
    ({body}) => ({
        data: body()
    }),
    "create",
    userGroup.create
)

export const updateUserGroup = new Handler(
    "POST",
    "/:id",
    zPropsUpdateFactory(userGroupZod),
    zResponseUpdateFactory(userGroupZod),
    ({body, param}) => ({
        data: body(),
        id: param()
    }),
    "update",
    userGroup.update
)

export const deleteUserGroup = new Handler(
    "DELETE",
    "/:id",
    zPropsDeleteFactory(userGroupZod),
    zResponseDeleteFactory(userGroupZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "delete",
    userGroup.delete
)