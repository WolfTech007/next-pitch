"use client";

import {
  NP_DEMO_DATE_COOKIE,
  NP_DEMO_DATE_HEADER,
  NP_DEMO_HEADER_ON,
  NP_DEMO_MODE_COOKIE,
  NP_DEMO_MODE_HEADER,
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
  const enabled = m?.[1] === NP_DEMO_HEADER_ON;
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
