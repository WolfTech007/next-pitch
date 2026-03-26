"use client";

import { useMemo } from "react";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pctFor(v: number, min: number, max: number) {
  return ((clamp(v, min, max) - min) / (max - min)) * 100;
}

function gaussian(x: number, mu: number, sigma: number) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * Visual-only “probability” heat used for the gradient track.
 * Uses pitcherAvgMph (if present) + a reasonable sigma.
 */
function velocityHeatStops(min: number, max: number, pitcherAvgMph?: number | null) {
  const mu = pitcherAvgMph ?? 93;
  const sigma = 3.6;
  const steps = 22;
  const pts = Array.from({ length: steps }, (_, i) => min + (i / (steps - 1)) * (max - min));
  const dens = pts.map((v) => gaussian(v, mu, sigma));
  const maxD = Math.max(...dens);
  const norm = dens.map((d) => (maxD > 0 ? d / maxD : 0));

  const colorFor = (t: number) => {
    // green (likely) -> yellow -> red (unlikely)
    if (t >= 0.72) return "rgba(34,197,94,0.95)";
    if (t >= 0.42) return "rgba(234,179,8,0.95)";
    return "rgba(239,68,68,0.95)";
  };

  return pts.map((v, i) => ({
    pct: pctFor(v, min, max),
    color: colorFor(norm[i] ?? 0),
  }));
}

export function VelocitySlider({
  value,
  onChange,
  min = 65,
  max = 110,
  pitcherAvgMph,
  disabled = false,
  className = "",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  pitcherAvgMph?: number | null;
  disabled?: boolean;
  className?: string;
}) {
  const v = value ?? Math.round((min + max) / 2);
  const stops = useMemo(() => velocityHeatStops(min, max, pitcherAvgMph), [min, max, pitcherAvgMph]);
  const gradient = useMemo(() => {
    const parts = stops.map((s) => `${s.color} ${s.pct.toFixed(2)}%`);
    return `linear-gradient(90deg, ${parts.join(",")})`;
  }, [stops]);

  return (
    <section className={`np-card np-card-interactive h-full p-3 shadow-np-card ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          Velocity
        </h2>
        <p className="font-mono text-[11px] text-white/40">
          {min} <span className="text-white/20">–</span> {max}
        </p>
      </div>

      <div className="relative">
        <div
          className="h-3.5 rounded-full border border-white/[0.10] shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]"
          style={{ background: gradient }}
          aria-hidden
        />
        <input
          type="range"
          min={min}
          max={max}
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-3.5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_18px_rgba(255,255,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Velocity (mph)"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
        <span className="font-mono">{min}</span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-mono text-sm font-semibold text-np-text">
          {v} mph
        </span>
        <span className="font-mono">{max}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[10px] text-white/35">±1 mph</p>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 transition hover:text-white/60 disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

