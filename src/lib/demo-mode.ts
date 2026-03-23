import { cookies, headers } from "next/headers";
import type { StoreData } from "@/lib/store";
import { normalizeStoreData, readStore } from "@/lib/store";
import {
  NP_DEMO_DATE_COOKIE,
  NP_DEMO_DATE_HEADER,
  NP_DEMO_HEADER_ON,
  NP_DEMO_MODE_COOKIE,
  NP_DEMO_MODE_HEADER,
  NP_DEMO_QUERY_PARAM,
  NP_DEMO_QUERY_VALUE,
} from "@/lib/demo-mode-constants";

export {
  NP_DEMO_DATE_COOKIE,
  NP_DEMO_DATE_HEADER,
  NP_DEMO_HEADER_ON,
  NP_DEMO_MODE_COOKIE,
  NP_DEMO_MODE_HEADER,
  NP_DEMO_QUERY_PARAM,
  NP_DEMO_QUERY_VALUE,
} from "@/lib/demo-mode-constants";

/** Eastern-calendar dates with full MLB slates (summer weekends + opening week). */
export const DEMO_SCHEDULE_DATES: string[] = [
  "2024-07-04",
  "2024-07-05",
  "2024-07-06",
  "2024-08-10",
  "2024-08-11",
  "2024-09-01",
  "2024-09-15",
  "2024-06-15",
  "2024-06-22",
  "2023-09-30",
  "2023-07-15",
  "2023-08-19",
];

export function pickRandomDemoDate(): string {
  const i = Math.floor(Math.random() * DEMO_SCHEDULE_DATES.length);
  return DEMO_SCHEDULE_DATES[i]!;
}

/**
 * Demo “play count” anchor from the current replay pitch index (matches live slip encoding shape).
 */
export function demoPlayCountFromPitchIndex(gamePk: number, pitchIndex: number): number {
  return pitchIndex * 9973 + gamePk * 17;
}

/** Inverse of {@link demoPlayCountFromPitchIndex} — pitch index from stored playCountAtBet. */
export function tickFromSimulatedPlayCount(gamePk: number, simulatedPlayCount: number): number {
  const base = gamePk * 17;
  const t = Math.floor((simulatedPlayCount - base) / 9973);
  return t < 0 ? 0 : t;
}

export function readDemoModeFromCookieHeader(header: string | null): boolean {
  if (!header) return false;
  return header.split(";").some((p) => p.trim().startsWith(`${NP_DEMO_MODE_COOKIE}=1`));
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    const v = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}

/**
 * Reads demo cookies for the request. Merges `cookies()` with the raw `Cookie` header so
 * cases where the header is present but the cookie jar is incomplete still pick up demo mode.
 */
export async function readDemoModeFromCookies(): Promise<{
  enabled: boolean;
  date: string | null;
}> {
  const jar = await cookies();
  const h = await headers();
  let enabled = jar.get(NP_DEMO_MODE_COOKIE)?.value === "1";
  let date = jar.get(NP_DEMO_DATE_COOKIE)?.value ?? null;

  const raw = h.get("cookie");
  if (!enabled) {
    enabled = readDemoModeFromCookieHeader(raw);
  }
  if (!date) {
    date = parseCookieValue(raw, NP_DEMO_DATE_COOKIE);
  }

  if (!enabled && h.get(NP_DEMO_MODE_HEADER) === NP_DEMO_HEADER_ON) {
    enabled = true;
  }
  if (!date) {
    const dh = h.get(NP_DEMO_DATE_HEADER);
    if (dh && /^\d{4}-\d{2}-\d{2}/.test(dh)) {
      date = dh.slice(0, 10);
    }
  }

  if (enabled && (!date || date.length < 8)) {
    date = DEMO_SCHEDULE_DATES[0] ?? null;
  }

  return { enabled, date };
}

/**
 * RSC pages: cookies + per-user Redis preference (set when logged-in user toggles demo).
 */
export async function resolveDemoModeForServerComponents(
  session: { userId: string } | null,
): Promise<{ enabled: boolean; date: string | null }> {
  const base = await readDemoModeFromCookies();
  if (base.enabled) return base;
  if (session) {
    const store = normalizeStoreData(await readStore(session.userId));
    if (store.demoModePreference === true) {
      const d = store.demoScheduleDate;
      return {
        enabled: true,
        date: d && d.length >= 8 ? d : DEMO_SCHEDULE_DATES[0] ?? null,
      };
    }
  }
  return base;
}

/**
 * API routes: Redis preference first, then cookies/headers, plus optional `?np_demo=1` and JSON
 * `{ clientDemoMode: true }` when cookies are missing on Vercel.
 */
export async function resolveDemoModeForApi(
  req: Request | null,
  options?: { clientAssertDemo?: boolean; store?: StoreData | null },
): Promise<{ enabled: boolean; date: string | null }> {
  const base = await readDemoModeFromCookies();

  if (options?.store?.demoModePreference === true) {
    const d = options.store.demoScheduleDate;
    return {
      enabled: true,
      date: d && d.length >= 8 ? d : DEMO_SCHEDULE_DATES[0] ?? null,
    };
  }

  if (base.enabled) return base;

  if (options?.clientAssertDemo === true) {
    return {
      enabled: true,
      date:
        base.date && base.date.length >= 8 ? base.date : DEMO_SCHEDULE_DATES[0] ?? null,
    };
  }

  if (req) {
    try {
      const u = new URL(req.url);
      if (u.searchParams.get(NP_DEMO_QUERY_PARAM) === NP_DEMO_QUERY_VALUE) {
        return {
          enabled: true,
          date:
            base.date && base.date.length >= 8 ? base.date : DEMO_SCHEDULE_DATES[0] ?? null,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return base;
}
