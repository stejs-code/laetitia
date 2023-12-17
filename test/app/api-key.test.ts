// import {describe, expect, it} from "bun:test";
// import {api, baseRequest} from "test/config.ts";
//
//
//
// describe("api-key", () => {
//     it("expires", async () => {
//         const apiKey = await api.json("/v1/app/api-key/_new", {
//             ...baseRequest,
//             method: "POST",
//             body: {
//                 author: {
//                     id: 1,
//                     name: "Tom Stejskal"
//                 },
//                 permissions: {
//                     "app.api-key.get": false
//                 },
//                 expiresAt: new Date(new Date().getTime() - 86400000)
//             }
//         })
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
//
//         expect(get.error).toBeTrue()
//         expect(get.message).toContain("expired")
//     })
//
// });