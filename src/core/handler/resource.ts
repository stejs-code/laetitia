import type {AnyZodObject} from "zod";
import {z, ZodError} from "zod";
import type {HandlerFunction} from "~/core/handler/handler.ts";
import {meilisearch} from "~/core/provider/meilisearch.ts";
import type {Index, MeiliSearch, Settings} from "meilisearch";
import {MeiliSearchApiError} from "meilisearch";
import {ApiError} from "~/core/apiError.ts";
import {getCount} from "~/core/utils/counter.ts";
import _ from "lodash";
import {error, info} from "~/core/utils/logger.ts";
import {defer} from "~/core/utils/defer.ts";
import type {MaybePromise} from "~/core/utils/types.ts";
import {getIndexName} from "~/core/utils/getIndexName.ts";
import {randomId} from "~/core/utils/randomId.ts";
import {redis} from "~/core/provider/redis.ts";
import type {RedisClientType} from "redis";
import {safeAsync} from "~/core/utils/safe.ts";
import StatusCode from "status-code-enum";

export const zCreatedAt = z.coerce.date().describe("date of the document creation")

export const zUpdatedAt = z.coerce.date().describe("date of the last document update")

export const zVersion = z.number().min(1)

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
    return doc.merge(zMeilisearchDocument).merge(z.object({
        _cache: z.boolean(),
        _index: z.string(),
    }))
}


export const zPropsSearchFactory = function () {
    return z.object({
        query: z.string(),
        filter: z.array(z.string().or(z.array(z.string()))).optional(),
        sort: z.array(z.string()).optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
    })
}

export const zResponseSearchFactory = function <ZDocument extends zDocumentBase>(doc: ZDocument) {
    return z.object({
        hits: doc.merge(zMeilisearchDocument).array(),
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
    return doc.merge(z.object({
        _index: z.string(),
    }))
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

    secretFields?: Partial<z.infer<ZDocument>>

    onGet?: (
        props: z.infer<ReturnType<typeof zPropsGetFactory<ZDocument>>>,
        next: ShortHandlerFunction<typeof zPropsGetFactory<ZDocument>, typeof zResponseGetFactory<ZDocument>>)
        => MaybePromise<z.infer<ReturnType<typeof zResponseGetFactory<ZDocument>>>>

    onUpdate?: (
        props: z.infer<ReturnType<typeof zPropsUpdateFactory<ZDocument>>>,
        next: ShortHandlerFunction<typeof zPropsUpdateFactory<ZDocument>, typeof zResponseUpdateFactory<ZDocument>>)
        => MaybePromise<z.infer<ReturnType<typeof zResponseUpdateFactory<ZDocument>>>>

    onDelete?: (
        props: z.infer<ReturnType<typeof zPropsDeleteFactory<ZDocument>>>,
        next: ShortHandlerFunction<typeof zPropsDeleteFactory<ZDocument>, typeof zResponseDeleteFactory<ZDocument>>)
        => MaybePromise<z.infer<ReturnType<typeof zResponseDeleteFactory<ZDocument>>>>
}

export type InputReturnType<T extends (...args: never[]) => AnyZodObject> = z.input<ReturnType<T>>
export type InferReturnType<T extends (...args: never[]) => AnyZodObject> = z.input<ReturnType<T>>

export class Resource<ZDocument extends zDocumentBase> {
    private readonly index: Index<z.infer<ZDocument> & z.infer<typeof zMeilisearchDocument>>;
    private meilisearch: MeiliSearch;
    private redis: RedisClientType;

    constructor(
        public zDocument: ZDocument,
        indexSettings: {
            name: string
        } & Partial<Settings>,
        public readonly settings: ResourceSettings<ZDocument> = {}
    ) {
        this.meilisearch = meilisearch
        this.index = meilisearch.index(getIndexName(indexSettings.name))
        this.redis = redis

        defer(async () => {
            // ensure, that index exists
            try {
                await this.index.getSettings()
            } catch (e) {
                await this.meilisearch.tasks.waitForTask((await meilisearch.createIndex(this.index.uid)).taskUid)
            }

            // ensure that index has the correct settings
            try {
                const settings = await this.index.getSettings()
                if (!Bun.deepEquals(settings, {...settings, ..._.omit(indexSettings, ["name"])})) {
                    info(`updating ${this.index.uid} settings`)
                    await this.meilisearch.tasks.waitForTask((await this.index.updateSettings(_.omit(indexSettings, ["name"]))).taskUid)
                    info(`${this.index.uid} settings are up to date`)
                }
            } catch (e) {
                error(`Unexpected error happened while updating ${this.index.uid} index.`)
                error(e)
            }
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

    async setToRedis(document: MeilisearchDocument<ZDocument>) {
        await this.redis.set(this.getRedisId(document.id), JSON.stringify(document))
    }

    getRedisId(id: number | string) {
        return this.index.uid + ":" + id
    }

    get = async (inputProps: InputReturnType<typeof zPropsGetFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseGetFactory<ZDocument>>> => {
        try {
            if (this.settings.onGet) {
                const props = zPropsGetFactory(this.zDocument).parse(inputProps, {path: ["resource", "get", "inputProps"]})
                return this.settings.onGet(props, this.getWithoutEvent)
            }
            return this.getWithoutEvent(inputProps)

        } catch (e) {
            if (e instanceof ZodError) {
                throw new ApiError(500, "props malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }

    getWithoutEvent = async (inputProps: InputReturnType<typeof zPropsGetFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseGetFactory<ZDocument>>> => {
        try {
            const props = zPropsGetFactory(this.zDocument).parse(inputProps, {path: ["resource", "getWithoutEvent", "inputProps"]})

            if (props.cache) {
                const document = await this.getFromRedis(props.id)

                if (document) {
                    return zResponseGetFactory(this.zDocument).parse({
                        _cache: true,
                        _index: this.index.uid,
                        ...this.replaceSecretKeys(document),
                    }, {path: ["resource", "getWithoutEventCache", "response"]})
                }
            }

            const document = this.zDocument.merge(zMeilisearchDocument).parse(await this.index.getDocument(props.id), {path: ["resource", "getWithoutEvent", "document"]}) as MeilisearchDocument<ZDocument>

            defer(() => {
                this.setToRedis(document)
            })

            return zResponseGetFactory(this.zDocument).parse({
                _cache: false,
                _index: this.index.uid,
                ...this.replaceSecretKeys(document),
            }, {path: ["resource", "getWithoutEvent", "response"]})
        } catch (e) {
            if (e instanceof MeiliSearchApiError) {
                throw new ApiError(404, "not found", undefined, this)
            }

            if (e instanceof ZodError) {
                throw new ApiError(500, "type parsing failed", "zod", e)
            }
            error(e)
            throw new ApiError(500, "unexpected error")
        }

    }


    search = async (inputProps: InputReturnType<typeof zPropsSearchFactory>): Promise<InferReturnType<typeof zResponseSearchFactory<ZDocument>>> => {
        try {
            const props = zPropsSearchFactory().parse(inputProps, {path: ["resource", "search", "inputProps"]})

            const {
                filter,
                limit,
                offset,
                query,
                sort
            } = props;

            const response = await this.index.search(query, {
                filter,
                sort,
                offset,
                limit
            })

            return zResponseSearchFactory(this.zDocument).parse({
                hits: response.hits.map(i => this.replaceSecretKeys(i))
            }, {path: ["resource", "search", "response"]})
        } catch (e) {
            if (e instanceof MeiliSearchApiError) {
                // TODO: be more specific

                error("Resource meilisearch search error:")
                error(e)
                throw new ApiError(500, "internal error in meilisearch")
            }

            if (e instanceof ZodError) {
                throw new ApiError(500, "document malformed", "zod", e)
            }

            error(e)
            throw new ApiError(500, "unexpected error")
        }
    }


    protected createId() {
        if (this.zDocument.shape.id.safeParse(1).success) {
            return getCount(this.index.uid)
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
                    version: 1
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

    update = async (inputProps: InputReturnType<typeof zPropsUpdateFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseUpdateFactory<ZDocument>>> => {
        try {
            if (this.settings.onUpdate) {
                const props = zPropsUpdateFactory(this.zDocument).parse(inputProps, {path: ["resource", "update", "inputProps"]})
                return this.settings.onUpdate(props, this.updateWithoutEvent)
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

    protected updateWithoutEvent = async (inputProps: InputReturnType<typeof zPropsUpdateFactory<ZDocument>>): Promise<InferReturnType<typeof zResponseUpdateFactory<ZDocument>>> => {
        try {
            const props = zPropsUpdateFactory(this.zDocument).parse(inputProps, {path: ["resource", "updateWithoutEvent", "inputProps"]})
            // * if previousDocument is undefined, then it's obvious that the document doesn't exist yet
            const previousDocument = await safeAsync(() => this.get({
                id: props.id
            }), undefined)


            if (previousDocument?.version && props.data.version) this.compareVersions(previousDocument.version, props.data.version)

            const document: MeilisearchDocument<ZDocument> = {
                ...previousDocument,
                ...props.data as z.infer<ZDocument>,
                id: props.id,
                updatedAt: new Date(),
                createdAt: previousDocument?.createdAt || new Date(),
                version: (previousDocument?.version || 0) + 1
            }

            defer(() => {
                this.setToRedis(document)
            })

            await this.meilisearch.tasks.waitForTask((await this.index.updateDocuments([document])).taskUid)

            return zResponseUpdateFactory(this.zDocument).parse({
                _index: this.index.uid,
                ...this.replaceSecretKeys(document),
            }, {path: ["resource", "updateWithoutEvent", "response"]})
        } catch (e) {
            if (e instanceof ApiError) throw e

            if (e instanceof MeiliSearchApiError) {
                throw new ApiError(500, "document wasn't created")
            }

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

            await this.meilisearch.tasks.waitForTask((await this.index.deleteDocument(props.id)).taskUid)

            await redis.del(this.getRedisId(props.id))

            return zResponseDeleteFactory(this.zDocument).parse({
                _index: this.index.uid,
                id: props.id,
                success: true
            }, {path: ["resource", "delete", "response"]})
        } catch (e) {
            if (e instanceof MeiliSearchApiError) {
                throw new ApiError(500, "document may not be deleted")
            }

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

}