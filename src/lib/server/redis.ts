import { Redis } from "@upstash/redis";
import { getRedisConnectionEnv } from "./redis-env";

let _redis: Redis | null = null;

/** Shared Upstash REST client (env from {@link getRedisConnectionEnv}). */
export function getRedis(): Redis {
  if (_redis) return _redis;
  const creds = getRedisConnectionEnv();
  if (!creds) {
    throw new Error(
      "[redis] Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN) in Vercel.",
    );
  }
  _redis = new Redis({ url: creds.url, token: creds.token });
  return _redis;
}
