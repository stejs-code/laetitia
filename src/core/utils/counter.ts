import {defer} from "~/core/utils/defer.ts";
import {elasticsearch} from "~/core/provider/elasticsearch.ts";

await elasticsearch.createIndex({
    index: "counter",
})

const counterMap = new Map((await elasticsearch.search<{ count: number }>({
    index: "counter",
    size: 1000,
})).data?.hits.hits.map((i) => [i._id, i._source?.count]))

export function getCount(idOfCounter: string) {
    const count = (counterMap.get(idOfCounter) || 0) + 1
    counterMap.set(idOfCounter, count)
    defer(async () => {
        const update = await elasticsearch.update({
            index: "counter",
            id: idOfCounter,
            doc: {count: count}
        })

        if (update.error) {
            await elasticsearch.index({
                index: "counter",
                id: idOfCounter,
                document: {count: count}
            })
        }
    })
    return count
}