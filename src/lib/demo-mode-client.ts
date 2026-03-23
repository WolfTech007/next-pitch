"use client";

import {
  NP_DEMO_DATE_COOKIE,
  NP_DEMO_DATE_HEADER,
  NP_DEMO_HEADER_ON,
  NP_DEMO_MODE_COOKIE,
  NP_DEMO_MODE_HEADER,
  NP_DEMO_QUERY_PARAM,
  NP_DEMO_QUERY_VALUE,
  NP_DEMO_SESSION_KEY,
} from "@/lib/demo-mode-constants";

function escCookieName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extra headers for same-origin `/api/*` fetches so the server sees demo mode even when
 * cookies are not attached to the request reliably (e.g. some Vercel serverless paths).
 */
export function demoModeRequestHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${escCookieName(NP_DEMO_MODE_COOKIE)}=([^;]*)`),
  );
  let enabled = m?.[1] === NP_DEMO_HEADER_ON;
  if (!enabled) {
    try {
      enabled = sessionStorage.getItem(NP_DEMO_SESSION_KEY) === NP_DEMO_HEADER_ON;
    } catch {
      /* ignore */
    }
  }
  if (!enabled) return {};
  const out: Record<string, string> = { [NP_DEMO_MODE_HEADER]: NP_DEMO_HEADER_ON };
  const dm = document.cookie.match(
    new RegExp(`(?:^|; )${escCookieName(NP_DEMO_DATE_COOKIE)}=([^;]*)`),
  );
  if (dm?.[1]) {
    try {
      const d = decodeURIComponent(dm[1].trim());
      if (d.length >= 8) out[NP_DEMO_DATE_HEADER] = d.slice(0, 10);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * True when demo is on: cookie, sessionStorage mirror, or parent passed intent.
 * sessionStorage is set when the toggle succeeds or when we see the demo cookie once.
 */
export function isClientDemoMode(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${escCookieName(NP_DEMO_MODE_COOKIE)}=([^;]*)`),
  );
  const fromCookie = m?.[1] === NP_DEMO_HEADER_ON;
  if (fromCookie) {
    try {
      sessionStorage.setItem(NP_DEMO_SESSION_KEY, NP_DEMO_HEADER_ON);
    } catch {
      /* private mode */
    }
    return true;
  }
  try {
    if (sessionStorage.getItem(NP_DEMO_SESSION_KEY) === NP_DEMO_HEADER_ON) return true;
  } catch {
    /* private mode */
  }
  return false;
}

/**
 * Appends `?np_demo=1` so GET handlers see demo when cookies are missing (Vercel).
 */
export function apiUrlWithDemoSearch(path: string): string {
  if (typeof document === "undefined") return path;
  if (!isClientDemoMode()) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${NP_DEMO_QUERY_PARAM}=${NP_DEMO_QUERY_VALUE}`;
}
