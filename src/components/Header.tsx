"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = {
  user: { id: string; email: string } | null;
  balance: number | null;
};

/**
 * Top bar: app name, balance when signed in, auth links.
 */
export function Header() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as Me;
      if (!cancelled) setMe(data);
    }
    tick();
    const t = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ user: null, balance: null });
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-surface-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          Next Pitch
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 text-sm">
          {me?.user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-zinc-500 sm:inline">
                {me.user.email}
              </span>
              <span className="text-zinc-400">Balance</span>
              <span className="rounded-md bg-surface-raised px-2 py-1 font-mono text-accent-green">
                {me.balance == null ? "…" : `$${me.balance.toFixed(2)}`}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-amber-400"
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
