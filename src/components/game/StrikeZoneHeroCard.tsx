"use client";

import type { ReactNode } from "react";

export function StrikeZoneHeroCard({
  titleRight,
  summaryLeft,
  onReset,
  cta,
  children,
  className = "",
}: {
  titleRight?: ReactNode;
  summaryLeft: ReactNode;
  onReset: () => void;
  cta: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`np-card np-card-interactive relative flex min-h-0 flex-col overflow-hidden p-5 shadow-np-card ${className}`}
    >
      <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_30%_10%,rgba(37,99,255,0.22),transparent_55%)]" />
      <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_70%_60%,rgba(0,207,255,0.14),transparent_60%)]" />

      <div className="relative shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Strike zone
          </h2>
          <span className="rounded-full border border-np-cyan/30 bg-np-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-cyan">
            Live
          </span>
          {titleRight ? <div className="ml-auto">{titleRight}</div> : null}
        </div>
      </div>

      <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center">
        {/* Batter silhouette (subtle, non-interactive). */}
        <div
          className="pointer-events-none absolute right-6 top-2 h-[92%] w-[54%] opacity-[0.14] blur-[0.2px]"
          aria-hidden
        >
          <div className="h-full w-full rounded-[32px] bg-gradient-to-b from-np-blue/50 via-white/10 to-transparent" />
        </div>
        <div className="relative w-full max-w-[640px] flex-1 min-h-[420px]">{children}</div>
      </div>

      <div className="relative mt-4 shrink-0">
        <div className="flex items-center justify-between gap-4 rounded-np-control border border-white/[0.08] bg-black/25 px-4 py-3">
          <div className="min-w-0 text-xs text-white/55">{summaryLeft}</div>
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 transition hover:text-white/60"
          >
            Reset
          </button>
        </div>

        <div className="mt-3">{cta}</div>
      </div>
    </section>
  );
}

