"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not register.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-blue">
        Next Pitch
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold text-white">Create account</h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        You start with <span className="text-zinc-300">$1,000</span> fake balance. One wallet per
        email.
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
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-500">
          Password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="mt-1 block text-[10px] text-zinc-600">At least 8 characters.</span>
        </label>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber-500/90 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-500/90 hover:text-amber-400">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Back to games
        </Link>
      </p>
    </main>
  );
}
