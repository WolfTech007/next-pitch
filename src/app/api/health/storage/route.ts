import { NextResponse } from "next/server";
import { getRedisConnectionEnv } from "@/lib/server/redis-env";

/**
 * Quick check that Redis env is visible to serverless (no secrets exposed).
 * Open: `https://YOUR_DEPLOYMENT.vercel.app/api/health/storage`
 */
export async function GET() {
  const creds = getRedisConnectionEnv();
  return NextResponse.json({
    redisEnvConfigured: creds !== null,
    vercel: Boolean(process.env.VERCEL),
    hint: creds
      ? "Redis env OK — if sign-up still fails, redeploy after changing env."
      : "Missing URL/token — Vercel → Settings → Environment Variables → add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_*), for Production, then Redeploy.",
  });
}
