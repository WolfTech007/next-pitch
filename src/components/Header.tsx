"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrlWithDemoSearch, demoModeRequestHeaders } from "@/lib/demo-mode-client";

type Me = {
  user: { id: string; email: string } | null;
  balance: number | null;
};

/**
 * Top command bar — product identity, balance, auth.
 */
export function Header() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch(apiUrlWithDemoSearch("/api/auth/me"), {
        cache: "no-store",
        credentials: "include",
        headers: demoModeRequestHeaders(),
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as Me;
      if (!cancelled) setMe(data);
    }
    tick();
    const t = setInterval(tick, 8000);

    function onBalance(e: Event) {
      const bal = (e as CustomEvent<number>).detail;
      if (typeof bal === "number") {
        setMe((prev) => (prev ? { ...prev, balance: bal } : prev));
      }
    }
    window.addEventListener("np:balance", onBalance);

    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("np:balance", onBalance);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ user: null, balance: null });
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#060B16]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-bold tracking-tight text-np-text"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-np-blue/40 bg-gradient-to-br from-np-blue/25 to-transparent text-[11px] font-black text-np-blue-bright shadow-[0_0_20px_rgba(37,99,255,0.25)]">
            NP
          </span>
          <span className="hidden sm:inline">Next Pitch</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 text-sm">
          {me?.user ? (
            <>
              <span className="hidden max-w-[160px] truncate text-xs text-white/45 sm:inline">
                {me.user.email}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-np-panel/60 px-3 py-1 text-[11px] font-medium text-white/50">
                Balance
              </span>
              <span className="rounded-np-control border border-np-success/35 bg-np-success/10 px-3 py-1.5 font-mono text-sm font-semibold text-np-success shadow-[0_0_16px_rgba(34,197,94,0.15)]">
                {me.balance == null ? "…" : `$${me.balance.toFixed(2)}`}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="np-btn-secondary text-xs"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="np-btn-secondary text-xs">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-np-control bg-gradient-to-b from-np-blue-bright to-np-blue px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_20px_rgba(37,99,255,0.35)] transition hover:brightness-110"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
