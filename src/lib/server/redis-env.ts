/**
 * Single source of truth — matches `@upstash/redis` `Redis.fromEnv()` precedence:
 * UPSTASH_* first, then KV_* (Vercel legacy KV names).
 */
export function getRedisConnectionEnv(): { url: string; token: string } | null {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const url = rawUrl?.trim();
  const token = rawToken?.trim();
  if (!url || !token) return null;
  return { url, token };
}
