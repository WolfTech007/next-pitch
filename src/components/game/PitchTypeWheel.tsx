"use client";

import type { PitchType } from "@/lib/markets";

const OPTIONS: ("" | PitchType)[] = ["", "Fastball", "Slider", "Curveball", "Changeup", "Other"];

function labelFor(v: "" | PitchType) {
  return v === "" ? "Optional" : v;
}

export function PitchTypeWheel({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: "" | PitchType;
  onChange: (v: "" | PitchType) => void;
  disabled?: boolean;
  className?: string;
}) {
  const idx = Math.max(0, OPTIONS.indexOf(value));
  const prev = OPTIONS[(idx - 1 + OPTIONS.length) % OPTIONS.length]!;
  const next = OPTIONS[(idx + 1) % OPTIONS.length]!;

  return (
    <section className={`np-card np-card-interactive h-full p-3 shadow-np-card ${className}`}>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        Pitch type
      </h2>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled}
          aria-label="Previous pitch type"
          onClick={() => onChange(prev)}
          className="h-8 w-8 rounded-np-control border border-white/[0.10] bg-np-panel/55 text-white/70 transition hover:border-np-blue/35 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="mx-auto inline-flex items-center gap-3">
            <span className="hidden text-xs text-white/25 sm:inline">{labelFor(prev)}</span>
            <span className="rounded-full border border-np-blue/35 bg-np-blue/15 px-4 py-1 text-sm font-semibold text-np-text shadow-[0_0_22px_rgba(37,99,255,0.14)]">
              {labelFor(value)}
            </span>
            <span className="hidden text-xs text-white/25 sm:inline">{labelFor(next)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          aria-label="Next pitch type"
          onClick={() => onChange(next)}
          className="h-8 w-8 rounded-np-control border border-white/[0.10] bg-np-panel/55 text-white/70 transition hover:border-np-blue/35 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </section>
  );
}

