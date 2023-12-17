import {describe, expect, it} from "bun:test";
import {api} from "test/config.ts";

describe('resource', () => {
    it("crud", async () => {

        const create = await api.post("/app/api-key", {
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {
                    "app.api-key.create": true
                },
                expiresAt: new Date()
            }
        })

        if (create.body.error) {
            console.error(Bun.inspect(create, {depth: 10}))
        }

        expect(create.body.message).toBeUndefined()

        expect(create.body.id).toBeString()

        const create2 = await api.post("/app/api-key", {
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {
                    "app.api-key.create": true
                },
                expiresAt: new Date()
            }
        })

        if (create2.body.error) {
            console.error(create)
        }
        expect(create2.body.message).toBeUndefined()

        expect(create2.body.id).toBeString()

        const get = await api.get(`/app/api-key/${create2.body.id}`)

        if (get.body.error) {
            console.error(get)
        }

        expect(get.body.message).toBeUndefined()
        expect(get.body.author.name).toBe(create2.body.author.name)

        await api.post(`/app/api-key/${create2.body.id}`, {
            body: {
                author: {
                    id: 2,
                    name: "Jana Braná"
                }
            }
        })
        const get2 = await api.get(`/app/api-key/${create2.body.id}`)

        expect(get2.body.id).toEqual(create2.body.id)
        expect(get2).not.toEqual(get)

        await api.delete(`/app/api-key/${create2.body.id}`)

        const get3 = await api.get(`/app/api-key/${create2.body.id}`)

        expect(get3.status).toBe(404)
    })

    it("permissions", async () => {
        const apiKey = await api.post("/app/api-key", {
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {
                    "app.api-key.create": true,
                    "app.api-key.get": false
                },
                expiresAt: new Date(new Date().getTime() + 86400000)
            }
        })

        const create = await api.post("/app/api-key", {
            headers: {
                Authorization: `Bearer ${apiKey.body.id}`
            },
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {},
                expiresAt: new Date()
            }
        })

        if (create.body.error) console.error(create)
        expect(create.body.error).toBe(false)


        const get = await api.get(`/app/api-key/${apiKey.body.id}`, {
            headers: {
                Authorization: `Bearer ${apiKey.body.id}`
            }
        })

        expect(get.status).toBe(401)
        expect(get.body.message).toContain("app.api-key.get")

    })

    it("versions", async () => {
        const create = await api.post("/app/api-key", {
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {
                    "app.api-key.create": true
                },
                expiresAt: new Date()
            }
        })

        expect(create.body.id).toBeString()

        // meant to succeed
        const update1 = await api.post(`/app/api-key/${create.body.id}`, {
            body: {
                author: {
                    id: 2,
                    name: "Tom Stejskal"
                }
            }
        })

        expect(update1.body.error).toBe(false)

        // meant to succeed
        const update2 = await api.post(`/app/api-key/${create.body.id}`, {
            body: {
                version: 3,
                author: {
                    id: 3,
                    name: "Tom Stejskal"
                },
            }
        })

        expect(update2.body.error).toBe(false)

        // meant not to succeed
        const update3 = await api.post(`/app/api-key/${create.body.id}`, {
            body: {
                version: 3,
                author: {
                    id: 4,
                    name: "Tom Stejskal"
                },
            }
        })

        expect(update3.body.error).toBe(true)

        const document = await api.get(`/app/api-key/${create.body.id}`)

        expect(document.body.version).toBe(3)
    })

});
