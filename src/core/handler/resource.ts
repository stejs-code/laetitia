import type {AnyZodObject} from "zod";
import {z, ZodError} from "zod";
import type {HandlerFunction} from "~/core/handler/handler.ts";
import {ApiError} from "~/core/apiError.ts";
import {getCount} from "~/core/utils/counter.ts";
import {error} from "~/core/utils/logger.ts";
import {defer} from "~/core/utils/defer.ts";
import type {MaybePromise} from "~/core/utils/types.ts";
import {getIndexName} from "~/core/utils/getIndexName.ts";
import {randomId} from "~/core/utils/randomId.ts";
import {redis} from "~/core/provider/redis.ts";
import type {RedisClientType} from "redis";
import {safeAsync} from "~/core/utils/safe.ts";
import StatusCode from "status-code-enum";
import type {ServerFunction} from "~/core/handler/function.ts";
import {ApiContext} from "~/core/handler/apiContext.ts";
import {elasticsearch} from "~/core/provider/elasticsearch.ts";
import type {IndicesIndexSettings} from "@elastic/elasticsearch/lib/api/types";

export const zCreatedAt = z.coerce.date().describe("date of the document creation")

export const zUpdatedAt = z.coerce.date().describe("date of the last document update")

export const zVersion = z.number().min(0)

export const zMeilisearchDocument = z.object({
    // id: z.string() as z.ZodString | z.ZodNumber,
    version: zVersion,
    createdAt: zCreatedAt,
    updatedAt: zUpdatedAt
})

export type MeilisearchDocument<T extends AnyZodObject> = z.infer<typeof zMeilisearchDocument> & z.infer<T>


export type zDocumentBase = z.ZodObject<{
    id: z.ZodNumber | z.ZodString
}, "strip">

export type ShortHandlerFunction<PropsFunction extends (doc: never) => AnyZodObject, ResponseFunction extends (doc: never) => AnyZodObject> = HandlerFunction<
    ReturnType<PropsFunction>, ReturnType<ResponseFunction>
>

export const zPropsGetFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        id: doc.shape.id,
        cache: z.boolean().default(true),
    })
}

export const zResponseGetFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return zMeilisearchDocument.merge(z.object({
        _cache: z.boolean(),
        _index: z.string(),
    })).merge(doc)
}


export const zPropsSearchFactory = function () {
    return z.object({
        query: z.record(z.any()).describe("https://www.elastic.co/guide/en/elasticsearch/reference/8.11/filter-search-results.html"),
        sort: z.array(
            z.union([z.string(), z.record(z.union([z.literal("desc"), z.literal("asc")]))])
        ).optional().describe("https://www.elastic.co/guide/en/elasticsearch/reference/8.11/sort-search-results.html"),
        size: z.number().default(20).describe("result documents limit"),
        from: z.number().default(0).describe("search offset (pagination)"),
        aggs: z.record(z.object({
            terms: z.object({
                field: z.string()
            })
        })).optional().describe("unfinished typing: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html")
    })
}

export const zResponseSearchFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        hits: zMeilisearchDocument.merge(doc).array(),
    })
}

export const zPropsCreateFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        data: z.object({
            version: zVersion.optional(),
        })
            .merge(doc)
            .omit({
                id: true
            })

    })
}

// Response same as update

export const zPropsUpdateFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        id: doc.shape.id,
        data: doc.omit({id: true})
            .merge(z.object({
                version: zVersion.optional(),
            }))
            .partial(),
    })
}

export const zResponseUpdateFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        _index: z.string(),
    }).merge(doc)
}

// Response same as update


export const zPropsDeleteFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        id: doc.shape.id
    })
}

export const zResponseDeleteFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        _index: z.string(),
        id: doc.shape.id,
    })
}

export const zPropsBulkCreate = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        data: zPropsCreateFactory(doc).shape.data.array().max(200)
    })
}

export const zResponseBulkCreate = function () {
    return z.object({
        created: z.number(),
        errors: z.number(),
    })
}


export type ResourceSettings<ZDocument extends zDocumentBase> = {
    description?: string

    dependantFields?: Partial<{
        [Key in keyof ZDocument["shape"]]: {
            resourceId: string,
            // @ts-expect-error WTF, if you use "keyof" to index shape, then why is typescript mad that "There could be other type", it's fucking nonsense...
            transform: (document: any) => z.input<ZDocument["shape"][Key]>
        }
    }>
    // dependantFields?: { [Key in keyof ZDocument["shape"]]: [Resource<any>, () => z.input<ZDocument["shape"][Key]>] }

    // getRelations?:() => MaybePromise<Partial<{ [Key in keyof ZDocument["shape"]]: { class: Resource<any>, transformer: (document: any) => z.input<ZDocument["shape"][Key]> } }>>

    secretFields?: Partial<z.infer<ZDocument>>

    // onGet?: (
    //     props: z.infer<ReturnType<typeof zPropsGetFactory<ZDocument>>>,
    //     next: ShortHandlerFunction<typeof zPropsGetFactory<ZDocument>, typeof zResponseGetFactory<ZDocument>>)
    //     => MaybePromise<z.infer<ReturnType<typeof zResponseGetFactory<ZDocument>>>>

    onGet?: ServerFunction<
        z.infer<ReturnType<typeof zPropsGetFactory<ZDocument>>> & {
        next: ShortHandlerFunction<typeof zPropsGetFactory<never>, typeof zResponseGetFactory<never>>
    },
        MaybePromise<z.infer<ReturnType<typeof zResponseGetFactory<ZDocument>>>>,
        {}
    >

    // onUpdate?: (
    //     props: z.infer<ReturnType<typeof zPropsUpdateFactory<ZDocument>>>,
    //     next: ShortHandlerFunction<typeof zPropsUpdateFactory<ZDocument>, typeof zResponseUpdateFactory<ZDocument>>)
    //     => MaybePromise<z.infer<ReturnType<typeof zResponseUpdateFactory<ZDocument>>>>

    onUpdate?: ServerFunction<
        z.infer<ReturnType<typeof zPropsUpdateFactory<ZDocument>>> & {
        next: ShortHandlerFunction<typeof zPropsUpdateFactory<never>, typeof zResponseUpdateFactory<never>>
    },
        MaybePromise<z.infer<ReturnType<typeof zResponseUpdateFactory<ZDocument>>>>,
        {}
    >

    // onDelete?: (
    //     props: z.infer<ReturnType<typeof zPropsDeleteFactory<ZDocument>>>,
    //     next: ShortHandlerFunction<typeof zPropsDeleteFactory<ZDocument>, typeof zResponseDeleteFactory<ZDocument>>)
    //     => MaybePromise<z.infer<ReturnType<typeof zResponseDeleteFactory<ZDocument>>>>

    onDelete?: ServerFunction<
        z.infer<ReturnType<typeof zPropsDeleteFactory<ZDocument>>> & {
        original: z.infer<ZDocument>,
        next: ShortHandlerFunction<typeof zPropsDeleteFactory<ZDocument>, typeof zResponseDeleteFactory<ZDocument>>
    },
        MaybePromise<z.infer<ReturnType<typeof zResponseDeleteFactory<ZDocument>>>>,
        {}
    >
}

export type InputReturnType<T extends (...args: never[]) => AnyZodObject> = z.input<ReturnType<T>>
export type InferReturnType<T extends (...args: never[]) => AnyZodObject> = z.infer<ReturnType<T>>

export class Resource<ZDocument extends zDocumentBase> {
    private readonly index: string;
    private redis: RedisClientType;
    public dependentsSet = new Set<Omit<DependencyType<any, any>, "resourceId"> & { resource: Resource<any> }>

    constructor(
        public zDocument: ZDocument,
        indexSettings: {
            name: string
        } & Partial<IndicesIndexSettings>,
        public readonly settings: ResourceSettings<ZDocument> = {}
    ) {
        this.index = getIndexName(indexSettings.name)
        this.redis = redis

        defer(async () => {
            // ensure, that index exists
            await elasticsearch.createIndex({
                index: this.index
            })
        })
    }


    async getFromRedis(id: number | string) {
        try {

            const response = await this.redis.get(this.getRedisId(id))

            if (response === null) return null

            const document = this.zDocument.merge(zMeilisearchDocument).safeParse(JSON.parse(response))

            if (document.success) {
                return document.data
            }

            defer(() => {
                error("record from redis is malformed " + Bun.inspect(document.error, {depth: 4}))
                redis.del(this.getRedisId(id))
            })

            return null
        } catch (e) {
            return null
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async setToRedis(document: MeilisearchDocument<ZDocument>) {
        // await this.redis.set(this.getRedisId(document.id), JSON.stringify(document))
    }

    getRedisId(id: number | string) {
        return this.index + ":" + id
    }

    get = async (inputProps: InputReturnType<typeof zPropsGetFactory<never>>): Promise<InferReturnType<typeof zResponseGetFactory<never>>> => {
        try {
            if (this.settings.onGet) {
                const props = zPropsGetFactory(this.zDocument).parse(inputProps, {path: ["resource", "get", "inputProps"]})
                return this.settings.onGet.prepare(ApiContext.superUser())({
                    ...props,
                    next: this.getWithoutEvent
                })
            }
            return this.getWithoutEvent(inputProps)

        } catch (e) {
            if (e instanceof ApiError) throw e

            if (e instanceof ZodError) {
                throw new ApiError(500, "props malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }

    getWithoutEvent = async (inputProps: InputReturnType<typeof zPropsGetFactory<never>>): Promise<InferReturnType<typeof zResponseGetFactory<never>>> => {
        try {
            const props = zPropsGetFactory(this.zDocument).parse(inputProps, {path: ["resource", "getWithoutEvent", "inputProps"]})

            if (props.cache) {
                const document = await this.getFromRedis(props.id)

                if (document) {
                    return zResponseGetFactory(this.zDocument).parse({
                        _cache: true,
                        _index: this.index,
                        ...this.replaceSecretKeys(document),
                    }, {path: ["resource", "getWithoutEventCache", "response"]})
                }
            }


            const response = await elasticsearch.get({
                index: this.index,
                id: String(props.id)
            })

            if (!response.data) throw new ApiError(404, "document not found")

            const document = this.zDocument
                .merge(zMeilisearchDocument)
                .parse(response.data._source, {path: ["resource", "getWithoutEvent", "document"]}) as MeilisearchDocument<ZDocument>

            defer(() => {
                this.setToRedis(document)
            })

            return zResponseGetFactory(this.zDocument).parse({
                _cache: false,
                _index: this.index,
                ...this.replaceSecretKeys(document),
            }, {path: ["resource", "getWithoutEvent", "response"]})
        } catch (e) {
            if (e instanceof ApiError) throw e
            if (e instanceof ZodError) {
                throw new ApiError(500, "type parsing failed", "zod", e)
            }
            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }


    search = async (inputProps: InputReturnType<typeof zPropsSearchFactory>): Promise<InferReturnType<typeof zResponseSearchFactory<never>>> => {
        try {
            const props = zPropsSearchFactory().parse(inputProps, {path: ["resource", "search", "inputProps"]})

            // TODO: Search params
            const response = await elasticsearch.search({
                index: this.index,
                query: props.query,
                aggs: props.aggs,
                size: props.size,
                from: props.from,
            })

            if (!response.data) {
                error(response.error)
                throw new ApiError(500, "unknown error happened while searching")
            }

            return zResponseSearchFactory(this.zDocument).parse({
                hits: response.data.hits.hits.map(i => this.replaceSecretKeys(i._source as any))
            }, {path: ["resource", "search", "response"]})
        } catch (e) {
            if (e instanceof ZodError) {
                throw new ApiError(500, "document malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }
    }


    protected createId() {
        if (this.zDocument.shape.id._def.typeName === "ZodNumber") {
            return getCount(this.index)
        }

        return randomId(20)
    }


    create = async (inputProps: InputReturnType<typeof zPropsCreateFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseUpdateFactory<ZDocument>>> => {
        try {
            const props = zPropsCreateFactory(this.zDocument).parse(inputProps, {path: ["resource", "create", "inputProps"]})

            const id = this.createId()

            const updatedProps = {
                ...props,
                data: {
                    ...props.data,
                    id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 0
                },
                id
            }

            return this.update(updatedProps)
        } catch (e) {
            if (e instanceof ApiError) throw e

            if (e instanceof ZodError) {
                throw new ApiError(500, "type parsing failed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }


    // patch = async (inputProps: InputReturnType<typeof zPropsPatchFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseUpdateFactory<ZDocument>>> => {
    //     try {
    //         const props = zPropsPatchFactory(this.zDocument).parse(inputProps, {path: ["resource", "patch", "inputProps"]})
    //
    //         const updatedProps = {
    //             ...props,
    //             data: {
    //                 ...await this.get({id: props.id, cache: false}),
    //                 ...props.data
    //             },
    //         }
    //
    //         return this.update(updatedProps)
    //     } catch (e) {
    //         if (e instanceof ApiError) throw e
    //
    //         if (e instanceof ZodError) {
    //             throw new ApiError(500, "document malformed", "zod", e)
    //         }
    //
    //         error(e)
    //         throw new ApiError(500, "unexpected error")
    //     }
    //
    // }

    update = async (inputProps: InputReturnType<typeof zPropsUpdateFactory<never>>): Promise<InferReturnType<typeof zResponseUpdateFactory<never>>> => {
        try {
            if (this.settings.onUpdate) {
                const props = zPropsUpdateFactory(this.zDocument).parse(inputProps, {path: ["resource", "update", "inputProps"]})

                return this.settings.onUpdate.prepare(ApiContext.superUser())({
                    ...props,
                    next: this.updateWithoutEvent
                })
            }

            return this.updateWithoutEvent(inputProps)
        } catch (e) {
            if (e instanceof ApiError) throw e

            if (e instanceof ZodError) {
                throw new ApiError(500, "props malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }
    }

    protected updateWithoutEvent = async (inputProps: InputReturnType<typeof zPropsUpdateFactory<never>>): Promise<InferReturnType<typeof zResponseUpdateFactory<never>>> => {
        try {
            const props = zPropsUpdateFactory(this.zDocument).parse(inputProps, {path: ["resource", "updateWithoutEvent", "inputProps"]})
            // * if previousDocument is undefined, then it's obvious that the document doesn't exist yet
            const previousDocument = await safeAsync(() => this.get({
                id: props.id
            }), undefined)

            // TODO: are dependencies up to date????? Client could have sent wrong data.

            if (previousDocument?.version && props.data.version) this.compareVersions(previousDocument.version, props.data.version)

            const document: MeilisearchDocument<ZDocument> = {
                ...previousDocument,
                ...props.data as z.infer<ZDocument>,
                _index: undefined,
                _cache: undefined,
                id: props.id,
                updatedAt: new Date(),
                createdAt: previousDocument?.createdAt || new Date(),
                version: (previousDocument?.version || 0) + 1
            }

            defer(() => {
                this.setToRedis(document)

                for (const {resource, transform, field} of this.dependentsSet) {
                    elasticsearch.updateByQuery({
                        index: resource.index,
                        script: {
                            source: "ctx._source[params.field] = params.data",
                            lang: "painless",
                            params: {
                                data: transform(document),
                                field: "event"
                            },
                        },
                        query: {
                            bool: {
                                filter: [
                                    {term: {[`${field}.id`]: document.id}}
                                ]
                            }
                        }
                    })
                }
            })

            if (previousDocument) {
                const response = await elasticsearch.update({
                    index: this.index,
                    id: String(document.id), // TODO: remove
                    doc: document
                })

                if (response.error) {
                    error(response.error)
                    throw new ApiError(500, "unexpected elastic error", "elastic")
                }
            } else {
                const response = await elasticsearch.index({
                    index: this.index,
                    id: String(document.id), // TODO: remove
                    document: document
                })

                if (response.error) {
                    error(response.error)
                    throw new ApiError(500, "unexpected elastic error", "elastic")
                }
            }


            return zResponseUpdateFactory(this.zDocument).parse({
                ...this.replaceSecretKeys(document),
                _index: this.index,
            }, {path: ["resource", "updateWithoutEvent", "response"]})
        } catch (e) {
            if (e instanceof ApiError) throw e

            if (e instanceof ZodError) {
                throw new ApiError(500, "document malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }

    delete = async (inputProps: InputReturnType<typeof zPropsDeleteFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseDeleteFactory<ZDocument>>> => {
        try {
            const props = zPropsDeleteFactory(this.zDocument).parse(inputProps, {path: ["resource", "delete", "inputProps"]})

            const response = await elasticsearch.delete({
                index: this.index,
                id: String(props.id)
            })

            if (response.error) {
                throw new ApiError(500, "unexpected elastic error", "elastic")
            }

            await redis.del(this.getRedisId(props.id))

            return zResponseDeleteFactory(this.zDocument).parse({
                _index: this.index,
                id: props.id,
                success: true
            }, {path: ["resource", "delete", "response"]})
        } catch (e) {
            if (e instanceof ZodError) {
                throw new ApiError(500, "document malformed", "zod", e)
            }

            throw new ApiError(500, "unexpected error")
        }

    }

    compareVersions(currentVersion: number, newVersion: number) {
        if (newVersion <= currentVersion) throw new ApiError(StatusCode.ClientErrorBadRequest, "version is smaller or equal to documents actual version")
    }

    // bulkCreate = async (inputProps: InputReturnType<typeof zPropsBulkCreate<ZDocument>>): Promise<InferReturnType<typeof zResponseBulkCreate>> => {
    //     /**
    //      * 1. validate and remove the problematic documents
    //      * 2.
    //       */
    //         try {
    //             const props = zPropsCreateFactory(this.zDocument).parse(inputProps, {path: ["resource", "create", "inputProps"]})
    //
    //             const id = this.createId()
    //
    //             const updatedProps = {
    //                 ...props,
    //                 data: {
    //                     ...props.data,
    //                     id
    //                 },
    //                 id
    //             }
    //
    //             return this.update(updatedProps)
    //         } catch (e) {
    //             if (e instanceof ApiError) throw e
    //
    //             if (e instanceof ZodError) {
    //                 throw new ApiError(500, "document malformed", "zod", e)
    //             }
    //
    //             error(e)
    //             throw new ApiError(500, "unexpected error")
    //         }
    //
    //
    //     return {
    //         created: 2,
    //         errors: 4
    //     }
    // }

    replaceSecretKeys<T extends Partial<z.infer<ZDocument>>>(document: T) {
        return {
            ...document,
            ...this.settings.secretFields
        }
    }

    /**
     *
     * @param resource The one to change
     * @param dependent
     */
    addDependent(resource: Resource<any>, dependent: DependencyType<ZDocument, any>) {
        this.dependentsSet.add({
            resource,
            transform: dependent.transform,
            field: dependent.field
        })
    }


    getDependencies() {
        return Object.entries(this.settings.dependantFields || {}).map(([k, v]): DependencyType<any, any> => ({
            resourceId: v.resourceId,
            transform: v.transform,
            field: k
        }))
    }
}

export type DependencyType<X, Y> = {
    resourceId: string,
    field: string,
    transform: (document: X) => Y,
}


/**
 *
 * @param resourceId This is the name with which is the resource exported from /endpoints directory
 * @param transform
 * @param validator
 */
export function dependency<
    Dependent extends { id: number | string },
    Validator extends AnyZodObject
>(resourceId: string, transform: DependencyType<z.infer<Validator>, Dependent>["transform"], validator?: Validator): Omit<DependencyType<z.infer<Validator>, Dependent>, "field"> {
    return {
        resourceId,
        transform(doc) {
            validator?.parse(doc)
            return transform(doc)
        }
    }
}