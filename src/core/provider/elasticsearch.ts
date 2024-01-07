import {ElasticClient} from "elastic-tiny-client";

// TODO: migrate to true elasticsearch client
export const elasticsearch = new ElasticClient({
    hosts: [
        Bun.env.ELASTIC_URL || "http://localhost:9200"
    ],
    authorization: {
        username: Bun.env.ELASTIC_USER || "elastic",
        password: Bun.env.ELASTIC_PASSWORD || "VerySecret"
    }
})