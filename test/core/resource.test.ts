// import {describe, expect, it} from "bun:test";
// import {api, baseRequest} from "test/config.ts";
//
// describe('resource', () => {
//     it("crud", async () => {
//
//         const create = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {
//                     "app.api-key.create": true
//                 },
//                 expiresAt: new Date()
//             }
//         })
//
//         if (create.error) {
//             console.error(Bun.inspect(create, {depth: 10}))
//         }
//
//         expect(create.message).toBeUndefined()
//
//         expect(create.id).toBeString()
//
//         const create2 = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             method: "POST",
//             body: JSON.stringify({
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {
//                     "app.api-key.create": true
//                 },
//                 expiresAt: new Date()
//             })
//         })
//
//         if (create2.error) {
//             console.error(create)
//         }
//         expect(create2.message).toBeUndefined()
//
//         expect(create2.id).toBeString()
//
//         const get = await api.json(`/v1/app/api-key/${create2.id}`, {
//             ...baseRequest,
//             method: "GET"
//         })
//
//         if (get.error) {
//             console.error(get)
//         }
//
//         expect(get.message).toBeUndefined()
//         expect(get.author.name).toBe(create2.author.name)
//
//         await api.json(`/v1/app/api-key/${create2.id}`, {
//             ...baseRequest,
//             method: "POST",
//             body: JSON.stringify({
//                 author: {
//                     id: 2,
//                     name: "Jana Braná"
//                 }
//             })
//         })
//         const get2 = await api.json(`/v1/app/api-key/${create2.id}`, {
//             ...baseRequest,
//             method: "GET"
//         })
//
//         expect(get2.id).toEqual(create2.id)
//         expect(get2).not.toEqual(get)
//
//         await api.json(`/v1/app/api-key/${create2.id}`, {
//             ...baseRequest,
//             method: "DELETE"
//         })
//
//         const get3 = await api.json(`/v1/app/api-key/${create2.id}`, {
//             ...baseRequest,
//             method: "GET"
//         })
//
//         expect(get3.status).toBe(404)
//     })
//
//     it("permissions", async () => {
//         const apiKey = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {
//                     "app.api-key.create": true,
//                     "app.api-key.get": false
//                 },
//                 expiresAt: new Date(new Date().getTime() + 86400000)
//             }
//         })
//
//         const create = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             headers: {
//                 ...baseRequest.headers,
//                 Authorization: `Bearer ${apiKey.id}`
//             },
//             method: "POST",
//             body: {
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {},
//                 expiresAt: new Date()
//             }
//         })
//
//         if (create.error) console.error(create)
//         expect(create.error).toBe(false)
//
//
//         const get = await api.json(`/v1/app/api-key/${apiKey.id}`, {
//             ...baseRequest,
//             headers: {
//                 ...baseRequest.headers,
//                 Authorization: `Bearer ${apiKey.id}`
//             },
//             method: "GET",
//         })
//
//         expect(get.status).toBe(401)
//         expect(get.message).toContain("app.api-key.get")
//
//     })
//
//     it("versions", async () => {
//         const create = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {
//                     "app.api-key.create": true
//                 },
//                 expiresAt: new Date()
//             }
//         })
//
//         expect(create.id).toBeString()
//
//         // meant to succeed
//         const update1 = await api.json(`/v1/app/api-key/${create.id}`, {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 author: {
//                     id: 2,
//                     name: "Tom Stejskal"
//                 }
//             }
//         })
//
//         expect(update1.error).toBe(false)
//
//         // meant to succeed
//         const update2 = await api.json(`/v1/app/api-key/${create.id}`, {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 version: 3,
//                 author: {
//                     id: 3,
//                     name: "Tom Stejskal"
//                 },
//             }
//         })
//
//         expect(update2.error).toBe(false)
//
//         // meant not to succeed
//         const update3 = await api.json(`/v1/app/api-key/${create.id}`, {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 version: 3,
//                 author: {
//                     id: 4,
//                     name: "Tom Stejskal"
//                 },
//             }
//         })
//
//         expect(update3.error).toBe(true)
//
//         const document = await api.json(`/v1/app/api-key/${create.id}`, {
//             ...baseRequest,
//             method: "GET"
//         })
//
//         expect(document.version).toBe(3)
//     })
//
// });
