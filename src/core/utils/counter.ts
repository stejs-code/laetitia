import {meilisearch} from "~/core/provider/meilisearch.ts";
import {defer} from "~/core/utils/defer.ts";

try {
    await meilisearch.getIndex("counter")
} catch (e) {
    await meilisearch.tasks.waitForTask((await meilisearch.createIndex("counter")).taskUid)
}

const counterMap = new Map((await meilisearch.index<{
    id: string,
    count: number
}>("counter").search("", {limit: 1000})).hits.map((i) => [i.id, i.count]))


export function getCount(idOfCounter: string) {
    const count = (counterMap.get(idOfCounter) || 0) + 1
    defer(async () => {
        counterMap.set(idOfCounter, count)
        await meilisearch.index("counter").addDocuments([{
            id: idOfCounter,
            count: count,
        }])
    })
    return count
}