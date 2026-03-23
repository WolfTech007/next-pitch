"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/Header";

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
    <>
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-np-cyan/90">
          Next Pitch
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-np-text">
          Create account
        </h1>
        <p className="mt-2 text-center text-sm text-white/50">
          You start with <span className="text-np-text">$1,000</span> fake balance. One wallet per
          email.
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
              autoComplete="new-password"
              required
              minLength={8}
              className="np-input mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-1 block text-[10px] text-white/35">At least 8 characters.</span>
          </label>
          {err ? <p className="text-sm text-np-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="np-btn-primary w-full py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/45">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-np-blue-bright hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs text-white/35 hover:text-white/55">
            ← Back to games
          </Link>
        </p>
      </main>
    </>
  );
}
