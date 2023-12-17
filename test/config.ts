import {router} from "~/entry.ts";
import {mock} from "@stricjs/router";
import {afterAll} from "bun:test";
import process from "node:process";

router.port = 3001

export const api = mock(router)

export const baseRequest = {
    headers: {
        Authorization: `Bearer ${Bun.env.API_MASTER_KEY}`
    }
}

afterAll(() => {
    process.exit()
})