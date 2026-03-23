import { NextResponse } from "next/server";
import {
  NP_DEMO_DATE_COOKIE,
  NP_DEMO_MODE_COOKIE,
  pickRandomDemoDate,
} from "@/lib/demo-mode";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore, writeStore } from "@/lib/store";

const COOKIE_BASE = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 180,
};

/**
 * POST /api/demo-mode  { "enabled": boolean }
 * Sets cookies so the whole app can switch between live (today) and demo (random slate date).
 */
export async function POST(req: Request) {
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const enabled = Boolean(body.enabled);
  const date = enabled ? pickRandomDemoDate() : null;
  const res = NextResponse.json({ ok: true, enabled, date });

  if (enabled && date) {
    res.cookies.set(NP_DEMO_MODE_COOKIE, "1", COOKIE_BASE);
    res.cookies.set(NP_DEMO_DATE_COOKIE, date, COOKIE_BASE);
  } else {
    res.cookies.set(NP_DEMO_MODE_COOKIE, "0", COOKIE_BASE);
    res.cookies.delete(NP_DEMO_DATE_COOKIE);
  }

  try {
    const session = await getSession();
    if (session) {
      const store = normalizeStoreData(await readStore(session.userId));
      if (enabled && date) {
        store.demoModePreference = true;
        store.demoScheduleDate = date;
      } else {
        store.demoModePreference = false;
        store.demoScheduleDate = null;
      }
      await writeStore(session.userId, store);
    }
  } catch {
    /* cookies still apply; Redis optional in dev */
  }

  return res;
}
