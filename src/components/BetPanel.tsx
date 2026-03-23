"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BAT_RESULT_BUCKETS,
  PITCH_TYPES,
  VELOCITY_BUCKETS,
  formatZonePickLabel,
  slipLegCount,
  type BattingResult,
  type LocationBucket,
  type PitchType,
  type SlipSelections,
  type VelocityBucket,
  type ZonePick,
} from "@/lib/markets";
import { countBasedHint } from "@/lib/countHint";
import { potentialPayout, quoteOdds } from "@/lib/odds";

/** Same as `DEMO_GAME_PK` in server — demo skips MLB count checks. */
const DEMO_GAME_ID = 999999;

const QUICK_PRESETS: {
  label: string;
  selections: SlipSelections;
}[] = [
  {
    label: "Fastball + full zone",
    selections: {
      pitchType: "Fastball",
      zonePick: { mode: "cells", cells: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    },
  },
  {
    label: "Slider + low band",
    selections: { pitchType: "Slider", zonePick: { mode: "cells", cells: [7, 8, 9] } },
  },
  { label: "Fastball 95+", selections: { pitchType: "Fastball", velocity: "95-97" } },
  {
    label: "Changeup + Ball",
    selections: { pitchType: "Changeup", zonePick: { mode: "ball" } },
  },
  { label: "Strike + Fastball", selections: { pitchType: "Fastball", battingResult: "Strike" } },
  { label: "Foul + Slider", selections: { pitchType: "Slider", battingResult: "Foul" } },
];

type Props = {
  gamePk: number;
  gameLabel: string;
  pitcherName?: string;
  batterName?: string;
  balls: number;
  strikes: number;
  scoreboardAtBet?: {
    balls: number;
    strikes: number;
    outs: number;
    inning: number;
    inningHalf: string;
  };
  /** Strike-zone placement from parent (pitch map). */
  zonePick: ZonePick | null;
  onZonePickChange: (z: ZonePick | null) => void;
  /** While true, map is locked — do not change placement from presets. */
  placementLocked: boolean;
  onPlaced?: (detail?: {
    betId: string;
    zonePick?: ZonePick | null;
    location?: LocationBucket;
  }) => void;
  className?: string;
};

function pickCountSel(s: SlipSelections): number {
  return slipLegCount(s);
}

/**
 * “Next Pitch” slip — quick picks submit immediately; manual picks use PLACE BET.
 */
export function BetPanel({
  gamePk,
  gameLabel,
  pitcherName,
  batterName,
  balls,
  strikes,
  scoreboardAtBet,
  zonePick,
  onZonePickChange,
  placementLocked,
  onPlaced,
  className = "",
}: Props) {
  const [pitchType, setPitchType] = useState<"" | PitchType>("");
  const [velocity, setVelocity] = useState<"" | VelocityBucket>("");
  const [battingResult, setBattingResult] = useState<"" | BattingResult>("");
  const [stake, setStake] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickKey, setQuickKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadDefault() {
      const res = await fetch("/api/bets");
      const data = await res.json();
      if (typeof data.defaultUnitSize === "number") {
        setStake(String(data.defaultUnitSize));
      }
    }
    loadDefault();
  }, []);

  const applyPreset = useCallback(
    (sel: SlipSelections) => {
      if (placementLocked) return;
      setPitchType(sel.pitchType ?? "");
      setVelocity(sel.velocity ?? "");
      setBattingResult(sel.battingResult ?? "");
      onZonePickChange(sel.zonePick ?? null);
    },
    [onZonePickChange, placementLocked],
  );

  const selections: SlipSelections = useMemo(() => {
    const s: SlipSelections = {};
    if (pitchType) s.pitchType = pitchType;
    if (velocity) s.velocity = velocity;
    if (battingResult) s.battingResult = battingResult;
    if (zonePick) s.zonePick = zonePick;
    return s;
  }, [pitchType, velocity, battingResult, zonePick]);

  const pickCount = slipLegCount(selections);

  const quote = useMemo(() => {
    if (pickCount < 1 || pickCount > 3) return null;
    return quoteOdds(selections);
  }, [pickCount, selections]);

  const stakeNum = Number(stake);
  const payout =
    quote && Number.isFinite(stakeNum) && stakeNum > 0
      ? potentialPayout(stakeNum, quote.offeredOdds)
      : 0;

  const hint = countBasedHint(balls, strikes);

  const presetQuotes = useMemo(() => {
    return QUICK_PRESETS.map((p) => {
      const n = pickCountSel(p.selections);
      const q = n >= 1 && n <= 3 ? quoteOdds(p.selections) : null;
      return { ...p, quote: q };
    });
  }, []);

  const submitWithSelections = useCallback(
    async (sel: SlipSelections, source: "quick" | "manual", quickLabel?: string) => {
      setMsg(null);
      const n = pickCountSel(sel);
      if (n < 1 || n > 3) {
        setMsg("Pick 1 to 3 categories.");
        return;
      }
      const q = quoteOdds(sel);
      if (!Number.isFinite(stakeNum) || stakeNum < 0.1 || stakeNum > 200) {
        setMsg("Unit size must be between $0.10 and $200.");
        return;
      }
      if (gamePk !== DEMO_GAME_ID && !scoreboardAtBet) {
        setMsg("Wait for the scoreboard to load, then try again.");
        return;
      }
      if (source === "quick" && quickLabel) setQuickKey(quickLabel);
      else setLoading(true);
      try {
        const res = await fetch("/api/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gamePk,
            gameLabel,
            pitcherName,
            batterName,
            scoreboardAtBet,
            selections: sel,
            stake: stakeNum,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg(data.error ?? "Could not place bet.");
          return;
        }
        setMsg(
          source === "quick"
            ? `Quick bet placed (${quickLabel ?? "preset"}) — resolves on next pitch.`
            : "Bet placed — resolves on next pitch.",
        );
        const bid = typeof data.bet?.id === "string" ? data.bet.id : undefined;
        if (bid) {
          onPlaced?.({
            betId: bid,
            zonePick: sel.zonePick ?? null,
            location: undefined,
          });
        } else {
          onPlaced?.();
        }
      } finally {
        setLoading(false);
        setQuickKey(null);
      }
    },
    [
      gamePk,
      gameLabel,
      pitcherName,
      batterName,
      scoreboardAtBet,
      stakeNum,
      onPlaced,
    ],
  );

  async function submitManual() {
    await submitWithSelections(selections, "manual");
  }

  const locationSummary =
    zonePick == null ? "— Choose on the pitch map" : formatZonePickLabel(zonePick) ?? "—";

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-5 shadow-xl ring-1 ring-zinc-800/50 ${className}`}
    >
      <div className="mb-4 border-b border-zinc-800/80 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Next pitch
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          <span className="text-zinc-300">{pitcherName ?? "Pitcher"}</span>
          <span className="mx-1 text-zinc-600">vs</span>
          <span className="text-zinc-300">{batterName ?? "Batter"}</span>
        </p>
        <p className="mt-2 text-sm leading-snug text-zinc-400">{hint}</p>
        <p className="mt-1 text-[10px] text-zinc-600">Fake money only · prototype</p>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Quick picks
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {presetQuotes.map((p) => {
            const busy = quickKey === p.label;
            const disabled =
              busy ||
              loading ||
              placementLocked ||
              (gamePk !== DEMO_GAME_ID && !scoreboardAtBet) ||
              !p.quote;
            return (
              <button
                key={p.label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  applyPreset(p.selections);
                  void submitWithSelections(p.selections, "quick", p.label);
                }}
                className="rounded-lg border border-zinc-700/90 bg-zinc-800/40 px-3 py-2.5 text-left text-xs transition hover:border-amber-500/40 hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="font-medium text-zinc-200">{p.label}</span>
                {p.quote ? (
                  <span className="mt-1 block font-mono text-accent-amber">
                    {p.quote.offeredOdds.toFixed(1)}x
                  </span>
                ) : (
                  <span className="mt-1 block text-zinc-600">—</span>
                )}
                {busy ? (
                  <span className="mt-1 block text-[10px] text-zinc-500">Placing…</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Categories
        </p>
        <label className="block text-[11px] text-zinc-500">
          Pitch type
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white transition hover:border-zinc-600"
            value={pitchType}
            onChange={(e) =>
              setPitchType((e.target.value || "") as "" | PitchType)
            }
          >
            <option value="">— Optional —</option>
            {PITCH_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] text-zinc-500">
          Velocity
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white transition hover:border-zinc-600"
            value={velocity}
            onChange={(e) =>
              setVelocity((e.target.value || "") as "" | VelocityBucket)
            }
          >
            <option value="">— Optional —</option>
            {VELOCITY_BUCKETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="block text-[11px] text-zinc-500">
          Location
          <div className="mt-1 rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-200">
            {locationSummary}
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            Use the pitch map: squares inside the zone (
            <span className="text-zinc-400">Custom</span>) or tap anywhere on the pitch map outside
            the strike-zone frame (<span className="text-zinc-400">Ball</span>).
          </p>
        </div>
        <label className="block text-[11px] text-zinc-500">
          Batting result
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white transition hover:border-zinc-600"
            value={battingResult}
            onChange={(e) =>
              setBattingResult((e.target.value || "") as "" | BattingResult)
            }
          >
            <option value="">— Optional —</option>
            {BAT_RESULT_BUCKETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-3 block text-[11px] text-zinc-500">
        Unit size
        <input
          type="number"
          step="0.01"
          min={0.1}
          max={200}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 font-mono text-sm text-white"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
      </label>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-black/30 px-4 py-3">
        {quote ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Odds</span>
              <span className="font-mono text-lg font-semibold text-accent-amber">
                {quote.offeredOdds.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Payout</span>
              <span className="font-mono text-accent-green">${payout.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-zinc-600">
              Prob {(quote.probability * 100).toFixed(2)}% (combined props)
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Pick 1–3 categories to see live pricing.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => submitManual()}
        disabled={loading || !quote || quickKey !== null}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:from-emerald-500 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Placing…" : "Place bet"}
      </button>

      {gamePk !== DEMO_GAME_ID ? (
        <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-600">
          Submit before the count changes — next pitch auto-settles pending slips.
        </p>
      ) : null}

      {msg ? (
        <p className="mt-3 text-center text-xs text-zinc-400">{msg}</p>
      ) : null}
    </div>
  );
}
