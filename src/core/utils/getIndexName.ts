export function getIndexName(index: string) {
    return `${Bun.env.INDEX_PREFIX || "default"}-${index}`
}