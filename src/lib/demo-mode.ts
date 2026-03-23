import { cookies, headers } from "next/headers";

export const NP_DEMO_MODE_COOKIE = "np_demo_mode";
export const NP_DEMO_DATE_COOKIE = "np_demo_date";

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
  let enabled = jar.get(NP_DEMO_MODE_COOKIE)?.value === "1";
  let date = jar.get(NP_DEMO_DATE_COOKIE)?.value ?? null;

  const raw = (await headers()).get("cookie");
  if (!enabled) {
    enabled = readDemoModeFromCookieHeader(raw);
  }
  if (!date) {
    date = parseCookieValue(raw, NP_DEMO_DATE_COOKIE);
  }

  if (enabled && (!date || date.length < 8)) {
    date = DEMO_SCHEDULE_DATES[0] ?? null;
  }

  return { enabled, date };
}
