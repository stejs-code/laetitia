import type {RedisClientType} from "redis";
import {createClient} from "redis";
import {error} from "~/core/utils/logger.ts";

export const redis = createClient({
    url: Bun.env.REDIS_URL || "redis://localhost:6379"
}) as RedisClientType

redis.on('error', err => error("redis error " + Bun.inspect(err, {depth: 6})));

await redis.connect()