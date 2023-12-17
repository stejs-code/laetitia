// import {Resource} from "~/core/handler/resource.ts";
// import {z} from "zod";
//
// export const sessionZod = z.object({
//     id: z.string(),
//     group: z.object({
//         id: z.number(),
//         name: z.string()
//     }),
//     user: z.object({
//         id: z.number(),
//         name: z.string()
//     }),
//     createdAt: z.date(),
//     expiresAt: z.date()
// })
//
// export type SessionType = z.infer<typeof sessionZod>
//
// export const session = new Resource(
//     sessionZod,
//     {
//         name: "session",
//         filterableAttributes: ["group.id", "user.id"]
//     }
// )
//
// export const {
//     get: GetSession,
//     create: CreateSession,
//     update: UpdateSession,
//     patch: PatchSession,
//     delete: DeleteSession,
// } = session

// (await import("~/endpoints/app/api-key")).createApiKey