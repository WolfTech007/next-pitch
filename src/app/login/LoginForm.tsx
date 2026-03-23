"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const next = nextPath.startsWith("/") ? nextPath : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Login failed.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-blue">
        Next Pitch
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        Use your account so your balance and bet history stay yours.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-6 shadow-xl ring-1 ring-zinc-800/50"
      >
        <label className="block text-[11px] font-medium text-zinc-500">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-0 focus:border-amber-500/50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-500">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber-500/90 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/register" className="text-amber-500/90 hover:text-amber-400">
          Create one
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Back to games
        </Link>
      </p>
    </>
  );
}
