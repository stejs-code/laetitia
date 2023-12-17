# Laetitia

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```

when using dates always use coerce type for correct parsing

```ts
z.coerce.date() !== z.date() 
```

# Snippets
### Delete all indexes
```ts
(await meilisearch.getIndexes()).results.forEach((i) => meilisearch.deleteIndex(i.uid))
```