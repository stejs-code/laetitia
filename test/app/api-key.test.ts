import {describe, expect, it} from "bun:test";
import {api} from "test/config.ts";


describe("api-key", () => {
    it("expires", async () => {
        const apiKey = await api.post("/app/api-key", {
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                permissions: {
                    "app.api-key.get": false
                },
                expiresAt: new Date(new Date().getTime() - 86400000)
            }
        })

        const get = await api.get(`/app/api-key/${apiKey.body.id}`, {
            headers: {
                Authorization: `Bearer ${apiKey.body.id}`
            }
        })

        expect(get.body.error).toBeTrue()
        expect(get.body.message).toContain("expired")
    })

});