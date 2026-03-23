/**
 * True when Vercel KV / Upstash Redis env is present (production persistence).
 * Local dev usually omits these and uses `data/*.json` on disk instead.
 */
export function hasKvStorage(): boolean {
  const kv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const upstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  return kv || upstash;
}
