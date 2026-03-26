"use client";

import type { PitchType, ZonePick } from "@/lib/markets";
import { formatZonePickLabel } from "@/lib/markets";

function fmtVel(v: string | null) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== "") return `${n} mph ±1`;
  return v;
}

export function BetSlipCard({
  zonePick,
  pitchType,
  velocity,
  stake,
  odds,
  payout,
  onStakeChange,
  onPlaceBet,
  canPlaceBet,
  placing,
  outcome,
  className = "",
}: {
  zonePick: ZonePick | null;
  pitchType: "" | PitchType;
  velocity: string | null;
  stake: string;
  odds: number | null;
  payout: number;
  onStakeChange: (v: string) => void;
  onPlaceBet: () => void;
  canPlaceBet: boolean;
  placing: boolean;
  outcome?: {
    zone: string;
    pitchType: string;
    velocity: string;
  } | null;
  className?: string;
}) {
  const zoneLabel = zonePick ? formatZonePickLabel(zonePick) ?? "Custom" : "—";
  const pt = pitchType ? pitchType : "—";
  const vel = fmtVel(velocity);

  return (
    <section className={`np-card np-card-interactive flex h-full min-h-0 flex-col p-4 shadow-np-card ${className}`}>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        Bet slip
      </h2>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/45">Zone</span>
          <span className="text-np-text">{zoneLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/45">Pitch type</span>
          <span className="text-np-text">{pt}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/45">Velocity</span>
          <span className="text-np-text">{vel}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-[11px] text-white/45">Unit size</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min={0.1}
            max={200}
            className="np-input w-24 text-right font-mono"
            value={stake}
            onChange={(e) => onStakeChange(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 rounded-np-control border border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-sm">
        {odds != null ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-white/45">Odds</span>
              <span className="font-mono text-lg font-semibold text-np-cyan">{odds.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/45">Payout</span>
              <span className="font-mono font-semibold text-np-success">${payout.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/45">Pick 1–3 categories to see live pricing.</p>
        )}
      </div>

      {outcome ? (
        <div className="mt-3 rounded-np-control border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Outcome</p>
          <div className="mt-1.5 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/45">Zone</span>
              <span className="text-np-text">{outcome.zone}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/45">Pitch type</span>
              <span className="text-np-text">{outcome.pitchType}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/45">Velocity</span>
              <span className="text-np-text">{outcome.velocity}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={onPlaceBet}
          disabled={!canPlaceBet}
          className="np-btn-primary w-full py-3 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
        >
          {placing ? "Placing…" : "Place bet"}
        </button>
      </div>
    </section>
  );
}

