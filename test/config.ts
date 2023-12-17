import {safeAsync} from "~/core/utils/safe.ts";

type RequestInit = Partial<{
    body: Record<string, any>,
    headers: Record<string, any>,
    query: Record<string, any>
}>

class Api {
    constructor(
        public apiKey: string,
        public url: string
    ) {
    }

    private async request(method: string, url: string, init: RequestInit) {

        const query = Object.entries(init.query || {}).map(([k, v]) => (`${k}=${encodeURIComponent(v)}`)).join("&")
        const finalUrl = this.url + url + "?" + query

        console.log(`Sending request to ${finalUrl}`)

        const response = await fetch(finalUrl, {
            method: method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                ...init.headers
            },
            body: JSON.stringify(init.body)
        })

        const body = await safeAsync(() => response.json(), {})

        return {
            body: body as Record<string, any>,
            status: response.status,
            headers: response.headers,
        }
    }

    get(url: string, init: Omit<RequestInit, "body"> = {}) {
        return this.request("GET", url, init)
    }

    post(url: string, init: RequestInit = {}) {
        return this.request("POST", url, init)
    }

    put(url: string, init: RequestInit = {}) {
        return this.request("PUT", url, init)
    }

    patch(url: string, init: RequestInit = {}) {
        return this.request("PATCH", url, init)
    }

    delete(url: string, init: RequestInit = {}) {
        return this.request("DELETE", url, {...init, body: init.body || {}})
    }


}

const masterKey = Bun.env.API_MASTER_KEY || ""


export const api = new Api(masterKey, "http://0.0.0.0:3000/v1")