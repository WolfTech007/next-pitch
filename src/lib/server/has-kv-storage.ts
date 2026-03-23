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

/** Vercel serverless has a read-only disk — file writes must not run in production without Redis. */
export function isVercelProductionFilesystem(): boolean {
  return process.env.VERCEL === "1";
}

export const MISSING_REDIS_MESSAGE =
  "Server storage isn’t set up yet. In Vercel: open your project → Storage → Create a Redis database (Upstash) → Connect to this project → Redeploy. Then try again.";
