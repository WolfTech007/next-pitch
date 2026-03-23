import { NextResponse } from "next/server";

/**
 * Confirms which git commit Vercel built (compare to `git rev-parse HEAD` locally).
 * GET /api/health/build
 */
export async function GET() {
  return NextResponse.json({
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    nodeEnv: process.env.NODE_ENV,
  });
}
