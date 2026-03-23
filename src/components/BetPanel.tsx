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
import {
  apiUrlWithDemoSearch,
  demoModeRequestHeaders,
  isClientDemoMode,
} from "@/lib/demo-mode-client";
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
      const res = await fetch(apiUrlWithDemoSearch("/api/bets"), {
        credentials: "include",
        cache: "no-store",
        headers: demoModeRequestHeaders(),
      });
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
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...demoModeRequestHeaders(),
          },
          body: JSON.stringify({
            gamePk,
            gameLabel,
            pitcherName,
            batterName,
            scoreboardAtBet,
            selections: sel,
            stake: stakeNum,
            clientDemoMode: isClientDemoMode(),
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
      className={`np-card np-card-interactive flex h-full min-h-0 flex-col p-5 shadow-np-card ${className}`}
    >
      <div className="mb-4 border-b border-white/[0.06] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Bet slip
          </p>
          {placementLocked ? (
            <span className="rounded-full border border-np-blue/40 bg-np-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-blue-bright">
              Locked
            </span>
          ) : (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Draft
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-white/50">
          <span className="text-np-text">{pitcherName ?? "Pitcher"}</span>
          <span className="mx-1 text-white/30">vs</span>
          <span className="text-np-text">{batterName ?? "Batter"}</span>
        </p>
        <p className="mt-2 text-sm leading-snug text-white/55">{hint}</p>
        <p className="mt-1 text-[10px] text-white/35">Fake money only · prototype</p>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Quick picks
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                className="rounded-np-control border border-white/[0.08] bg-np-panel/50 px-3 py-2.5 text-left text-xs transition hover:border-np-blue/40 hover:bg-np-blue/10 hover:shadow-[0_0_20px_rgba(37,99,255,0.12)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="font-medium text-np-text">{p.label}</span>
                {p.quote ? (
                  <span className="mt-1 block font-mono text-np-cyan">
                    {p.quote.offeredOdds.toFixed(1)}x
                  </span>
                ) : (
                  <span className="mt-1 block text-white/35">—</span>
                )}
                {busy ? (
                  <span className="mt-1 block text-[10px] text-white/45">Placing…</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Categories
        </p>
        <label className="block text-[11px] text-white/45">
          Pitch type
          <select
            className="np-input mt-1"
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
        <label className="block text-[11px] text-white/45">
          Velocity
          <select
            className="np-input mt-1"
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
        <div className="block text-[11px] text-white/45">
          Location
          <div className="mt-1 rounded-np-control border border-np-blue/25 bg-np-blue/5 px-3 py-2.5 text-sm text-np-text shadow-[inset_0_0_24px_rgba(37,99,255,0.06)]">
            {locationSummary}
          </div>
          <p className="mt-1 text-[10px] text-white/40">
            Use the pitch map: squares inside the zone (
            <span className="text-np-cyan/90">Custom</span>) or tap anywhere on the pitch map outside
            the strike-zone frame (<span className="text-np-cyan/90">Ball</span>).
          </p>
        </div>
        <label className="block text-[11px] text-white/45">
          Batting result
          <select
            className="np-input mt-1"
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

      <label className="mb-3 block text-[11px] text-white/45">
        Unit size
        <input
          type="number"
          step="0.01"
          min={0.1}
          max={200}
          className="np-input mt-1 font-mono"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
      </label>

      <div className="mb-4 rounded-np-control border border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-sm">
        {quote ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-white/45">Odds</span>
              <span className="font-mono text-lg font-semibold text-np-cyan">
                {quote.offeredOdds.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/45">Payout</span>
              <span className="font-mono font-semibold text-np-success">${payout.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-white/35">
              Prob {(quote.probability * 100).toFixed(2)}% (combined props)
            </p>
          </div>
        ) : (
          <p className="text-sm text-white/45">Pick 1–3 categories to see live pricing.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => submitManual()}
        disabled={loading || !quote || quickKey !== null}
        className="np-btn-primary w-full py-3.5 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Placing…" : "Place bet"}
      </button>

      {gamePk !== DEMO_GAME_ID ? (
        <p className="mt-3 text-center text-[10px] leading-relaxed text-white/35">
          Submit before the count changes — next pitch auto-settles pending slips.
        </p>
      ) : null}

      {msg ? (
        <p className="mt-3 text-center text-xs text-white/55">{msg}</p>
      ) : null}
    </div>
  );
}
