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
import {ServerFunction} from "~/core/handler/function.ts";

export const userZod = z.object({
    id: z.number(),
    name: z.string(),
    firstname: z.string(),
    lastname: z.string(),
    author: z.object({
        id: z.number(),
        name: z.string()
    }).nullish(),
    group: z.object({
        id: z.number(),
        name: z.string()
    }).default({
        id: 1,
        name: "uživatel"
    }),
    title: z.string().optional(),
    password: z.string().min(4).nullish(),
    email: z.string().email().nullish(),
    code: z.string().nullish()
})

export type UserType = z.infer<typeof userZod>

export const user = new Resource(
    userZod,
    {
        name: "user",
        filterableAttributes: ["author.id", "code"]
    },
    {
        dependantFields: {
            group: dependency("userGroup", ({id, name}) => ({
                id: id,
                name: name
            }),)
        },
        onGet: new ServerFunction((props) => {
            return props.next(props)
        }),
        secretFields: {
            password: "**secret**"
        }
    }
)

export const getUser = new Handler(
    "GET",
    "/:id",
    zPropsGetFactory(userZod),
    zResponseGetFactory(userZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "get",
    user.get
)

export const searchUser = new Handler(
    "POST",
    "/_search",
    zPropsSearchFactory(),
    zResponseSearchFactory(userZod),
    ({query, body}) => ({
        size: query("size"),
        from: query("from"),
        query: body("query"),
        sort: body("sort"),
        aggs: body("aggs")
    }),
    "get",
    user.search
)


export const createUser = new Handler(
    "POST",
    "/",
    zPropsCreateFactory(userZod.omit({name: true})),
    zResponseUpdateFactory(userZod),
    ({body}) => ({
        data: body()
    }),
    "create",
    async (props) => {
        return user.create({
            ...props,
            data: {
                ...props.data,
                // const isMatch = await Bun.password.verify(password, hash);
                password: props.data.password ? await Bun.password.hash(props.data.password, {
                    algorithm: "bcrypt",
                    cost: 10,
                }) : null,
                name: props.data.firstname + " " + props.data.lastname
            }
        })
    }
)

export const updateUser = new Handler(
    "POST",
    "/:id",
    zPropsUpdateFactory(userZod.omit({name: true})),
    zResponseUpdateFactory(userZod),
    ({body, param}) => ({
        data: body(),
        id: param()
    }),
    [["update", "updateMySelf"]],
    (props) => {
        return user.update(props)
    }
)

export const deleteUser = new Handler(
    "DELETE",
    "/:id",
    zPropsDeleteFactory(userZod),
    zResponseDeleteFactory(userZod),
    ({param, query}) => ({
        id: param(),
        cache: query()
    }),
    "delete",
    user.delete
)