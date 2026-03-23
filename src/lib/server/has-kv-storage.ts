import { getRedisConnectionEnv } from "./redis-env";

/**
 * True when Upstash REST URL + token are available (same rules as `getRedis()`).
 */
export function hasKvStorage(): boolean {
  return getRedisConnectionEnv() !== null;
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
  "Server storage isn’t set up yet. In Vercel → Settings → Environment Variables, ensure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_*) are set for Production, then Redeploy. Check /api/health/storage — redisEnvConfigured should be true.";
