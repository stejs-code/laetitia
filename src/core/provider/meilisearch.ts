import { MeiliSearch} from "meilisearch";

export const meilisearch = new MeiliSearch({
    host: Bun.env.MEILI_URL || "http://localhost:7700",
    apiKey: Bun.env.MEILI_MASTER_KEY,
})