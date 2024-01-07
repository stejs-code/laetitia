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
import {ApiError} from "~/core/apiError.ts";
import {getUserGroup} from "~/endpoints/user/group.ts";
import {searchUser} from "~/endpoints/user/user.ts";

export const sessionZod = z.object({
    id: z.string(),
    user: z.object({
        id: z.number(),
        name: z.string()
    }),
    group: z.object({
        id: z.number(),
        name: z.string(),
        permissions: permissionsZod
    }),
    details: z.object({
        ip: z.string().nullish(),
        country: z.string().nullish()
    }).nullish(),
    expiresAt: z.coerce.date(),
    createdAt: z.coerce.date()
})

export type Session = z.infer<typeof sessionZod>

export const session = new Resource(
    sessionZod,
    {
        name: "session",
    },
    {
        dependantFields: {
            user: dependency("user", ({id, name}) => ({id, name})),
            group: dependency("userGroup", ({id, name, permissions}) => ({id, name, permissions}))
        }
    }
)

export const getSession = new Handler(
    "GET",
    "/:id",
    zPropsGetFactory(sessionZod),
    zResponseGetFactory(sessionZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "get",
    session.get,
)

export const searchSession = new Handler(
    "POST",
    "/_search",
    zPropsSearchFactory(),
    zResponseSearchFactory(sessionZod),
    ({query, body}) => ({
        size: query("size"),
        from: query("from"),
        query: body("query"),
        sort: body("sort"),
        aggs: body("aggs")
    }),
    "get",
    session.search
)


export const createSession = new Handler(
    "POST",
    "/",
    zPropsCreateFactory(sessionZod.merge(z.object({
        expiresAt: sessionZod.shape.expiresAt.optional()
    }))),
    zResponseUpdateFactory(sessionZod),
    ({body}) => ({
        data: body()
    }),
    "create",
    (props) => {
        return session.create({
            ...props,
            data: {
                ...props.data,
                expiresAt: props.data.expiresAt || new Date(new Date().getTime() + 86400000) // + 1 day
            }
        })
    }
)
export const updateSession = new Handler(
    "POST",
    "/:id",
    zPropsUpdateFactory(sessionZod),
    zResponseUpdateFactory(sessionZod),
    ({body, param}) => ({
        data: body(),
        id: param()
    }),
    ["update", "create"],
    session.update
)

export const deleteSession = new Handler(
    "DELETE",
    "/:id",
    zPropsDeleteFactory(sessionZod),
    zResponseDeleteFactory(sessionZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "delete",
    session.delete
)

export const loginWithCode = new Handler(
    "POST",
    "/_login",
    z.object({
        data: z.object({
            code: z.string().optional()
        })
    }),
    sessionZod,
    ({body}) => ({
        data: body()
    }),
    "login",
    async ({data: {code}}, {searchUser, createSession, getUserGroup}) => {
        if (code) {
            const response = await searchUser.asSuper({
                query: {
                    bool: {
                        filter: [
                            [{term: {"code": code}}]
                        ]
                    }
                }
            })

            if (!response.hits.length) throw new ApiError(404, "Code not found")

            const user = response.hits[0]

            const group = await getUserGroup.asSuper({id: user.group.id})

            const session = await createSession.asSuper({
                data: {
                    group: group,
                    user: {
                        id: user.id,
                        name: user.name
                    },
                    createdAt: new Date()
                }
            })

            return {
                ...session
            }
        }

        throw new ApiError(400, "Both code and password are undefined")

    },
    {
        searchUser,
        createSession,
        getUserGroup
    }
)