import {describe, expect, it} from "bun:test";
import {api, baseRequest} from "test/config.ts";


describe("user", () => {
    it("secret fields", async () => {
        const user = await api.json("/v1/user/user", {
            ...baseRequest,
            method: "POST",
            body: {
                author: {
                    id: 1,
                    name: "Tom Stejskal"
                },
                firstname: "Tom",
                lastname: "Stejskal",
                password: "amogus",
                email: "tom@balon.cz",
            }
        })

        if (user.error) console.error(Bun.inspect(user, {depth: 16}))

        expect(user.error).toBeFalse()

        const get = await api.json(`/v1/user/user/${user.id}`, {
            ...baseRequest,
            method: "GET",
        })


        if (get.error) console.error(Bun.inspect(get, {depth: 6}))


        expect(get.error).toBeFalse()
        expect(get.password).toBe("**secret**")


    });
});