import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/**
 * Shared Upstash REST client. Vercel may expose either KV_* or UPSTASH_REDIS_* env names.
 */
export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "[redis] Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) in Vercel.",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}
