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
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-np-cyan/90">
        Next Pitch
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-np-text">Sign in</h1>
      <p className="mt-2 text-center text-sm text-white/50">
        Use your account so your balance and bet history stay yours.
      </p>

      <form
        onSubmit={onSubmit}
        className="np-card mt-8 space-y-4 rounded-np-card border border-white/[0.06] p-6 shadow-np-card"
      >
        <label className="block text-[11px] font-medium text-white/45">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            className="np-input mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-[11px] font-medium text-white/45">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            className="np-input mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err ? <p className="text-sm text-np-danger">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="np-btn-primary w-full py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/45">
        No account?{" "}
        <Link href="/register" className="font-medium text-np-blue-bright hover:underline">
          Create one
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-xs text-white/35 hover:text-white/55">
          ← Back to games
        </Link>
      </p>
    </>
  );
}
