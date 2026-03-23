"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  NP_DEMO_HEADER_ON,
  NP_DEMO_MODE_COOKIE,
  NP_DEMO_SESSION_KEY,
} from "@/lib/demo-mode-constants";

/**
 * Home-only control: switches schedule + wallet to demo slice (cookies).
 */
export function DemoModeToggle() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const m = document.cookie.match(
      new RegExp(`(?:^|; )${NP_DEMO_MODE_COOKIE}=([^;]*)`),
    );
    const on = m?.[1] === NP_DEMO_HEADER_ON;
    setEnabled(on);
    try {
      if (on) sessionStorage.setItem(NP_DEMO_SESSION_KEY, NP_DEMO_HEADER_ON);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked;
      setEnabled(next);
      await fetch("/api/demo-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      try {
        if (next) sessionStorage.setItem(NP_DEMO_SESSION_KEY, NP_DEMO_HEADER_ON);
        else sessionStorage.removeItem(NP_DEMO_SESSION_KEY);
      } catch {
        /* ignore */
      }
      router.refresh();
    },
    [router],
  );

  if (loading) {
    return (
      <div className="h-6 w-40 animate-pulse rounded bg-white/[0.06]" aria-hidden />
    );
  }

  return (
    <label className="flex cursor-pointer select-none items-center gap-3 text-sm text-white/70">
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={enabled}
          onChange={onChange}
        />
        <span
          className="block h-7 w-12 rounded-full border border-white/[0.12] bg-white/[0.06] transition peer-checked:border-np-cyan/40 peer-checked:bg-np-cyan/20"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white/80 shadow transition peer-checked:left-6 peer-checked:bg-np-cyan"
          aria-hidden
        />
      </span>
      <span className="font-medium text-np-text">Demo mode</span>
      <span className="text-xs text-white/45">Summer slate · fake wallet</span>
    </label>
  );
}
