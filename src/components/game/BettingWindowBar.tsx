"use client";

import { useEffect, useMemo, useState } from "react";

export function BettingWindowBar({
  startMs,
  durationMs = 15_000,
  className = "",
}: {
  startMs: number | null;
  durationMs?: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(t);
  }, []);

  const { remainingMs, pct } = useMemo(() => {
    if (startMs == null) return { remainingMs: durationMs, pct: 0 };
    const elapsed = Math.max(0, now - startMs);
    const remaining = Math.max(0, durationMs - elapsed);
    const p = Math.max(0, Math.min(1, remaining / durationMs));
    return { remainingMs: remaining, pct: p };
  }, [startMs, durationMs, now]);

  const seconds = Math.ceil(remainingMs / 1000);
  const label = `${seconds}s`;

  return (
    <section
      className={`np-card np-card-interactive mt-3 overflow-hidden border border-white/[0.06] bg-black/25 px-5 py-2 shadow-np-card ${className}`}
      aria-label="Betting window"
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/45">
          Betting window
        </p>
        <p className="font-mono text-[11px] font-semibold text-white/55">{label}</p>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-np-blue-bright via-np-cyan to-np-blue shadow-[0_0_18px_rgba(0,207,255,0.25)] transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.max(2, pct * 100)}%` }}
        />
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_50%,rgba(37,99,255,0.25),transparent_60%)]" />
      </div>
    </section>
  );
}

