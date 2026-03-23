const WARN_KEY = "__np_warned_session_secret" as const;

export function jwtSecretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 16)) {
    const g = globalThis as typeof globalThis & { [WARN_KEY]?: boolean };
    if (!g[WARN_KEY]) {
      g[WARN_KEY] = true;
      console.warn(
        "[auth] SESSION_SECRET is missing or short — add to `.env.local`: SESSION_SECRET=<long random string> (e.g. `openssl rand -base64 32`). Then restart the server.",
      );
    }
  }
  return new TextEncoder().encode(s || "dev-only-np-session-secret-min-32-chars!!");
}
