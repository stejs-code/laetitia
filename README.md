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

## Elasticsearch rules
### Ids
field "_id" is string, always, that's es policy\
field "id" could be number, for sorting, that decides developer for each resource