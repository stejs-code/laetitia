import {describe, expect, it} from "bun:test";
import {api} from "test/config.ts";


describe("user", () => {
    it("secret fields", async () => {
        // const user = await api.json("/v1/user/user", {
        //     ...baseRequest,
        //     method: "POST",
        //     body: {
        //         author: {
        //             id: 1,
        //             name: "Tom Stejskal"
        //         },
        //         firstname: "Tom",
        //         lastname: "Stejskal",
        //         password: "amogus",
        //         email: "tom@balon.cz",
        //     }
        // })

        const user = await api.post("/user/user", {
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

        if (user.body.error) console.error(Bun.inspect(user, {depth: 6}))

        expect(user.body.error).toBeFalse()

        const get = await api.get(`/user/user/${user.body.id}`)


        if (get.body.error) console.error(Bun.inspect(get, {depth: 6}))


        expect(get.body.error).toBeFalse()
        expect(get.body.password).toBe("**secret**")


    });

    it("two at once", async () => {
        const create1 = api.post("/user/user", {
            body: {
                firstname: "Tom",
                lastname: "Stejskal"
            }
        })


        const create2 = api.post("/user/user", {
            body: {
                firstname: "Tom",
                lastname: "Stejskal"
            }
        });

        const responses = await Promise.all([create1, create2]);
        expect(responses[0].body.id).not.toBe(responses[1].body.id)

    })
});