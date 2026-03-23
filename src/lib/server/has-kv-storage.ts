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

/**
 * Vercel / AWS Lambda use a read-only filesystem for the app bundle.
 * `VERCEL` is usually `"1"` but we accept any value; Lambda sets `AWS_LAMBDA_*`.
 */
export function isVercelProductionFilesystem(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV,
  );
}

export const MISSING_REDIS_MESSAGE =
  "Server storage isn’t set up yet. In Vercel: open your project → Storage → Create a Redis database (Upstash) → Connect to this project → Redeploy. Then try again.";
