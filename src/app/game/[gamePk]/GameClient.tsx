"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrlWithDemoSearch, demoModeRequestHeaders } from "@/lib/demo-mode-client";
import { BetHistory } from "@/components/BetHistory";
import { GameLiveHeader } from "@/components/game/GameLiveHeader";
import { PitchFeedList } from "@/components/game/PitchFeedList";
import { StrikeZoneCanvas } from "@/components/game/StrikeZoneCanvas";
import { Header } from "@/components/Header";
import type { GameSituation, RecentPitchFeedRow } from "@/lib/mlb";
import type { StoredBet } from "@/lib/store";
import {
  slipLegCount,
  type PitchType,
  type SlipSelections,
  type ZonePick,
} from "@/lib/markets";
import { potentialPayout, quoteOdds } from "@/lib/odds";
import { VelocitySlider } from "@/components/game/VelocitySlider";
import { PitchTypeWheel } from "@/components/game/PitchTypeWheel";
import {
  PitchResultReaction,
  type PitchReaction,
} from "@/components/game/PitchResultReaction";
import type { StrikePlacementPhase } from "@/components/game/StrikeZonePlacementLayer";

/** Same id as `DEMO_GAME_PK` in `mlb.ts` — demo games use manual resolve only. */
const DEMO_GAME_ID = 999999;

type GamePayload = {
  situation: GameSituation;
  playCount: number;
  feedSource?: "live_feed" | "linescore";
  settledCount?: number;
  lastPitchPreview?: {
    pitchType: string;
    velocity: string;
    location: string;
  };
  score?: { away: number; home: number };
  teamAbbr?: { away: string; home: string };
  recentPitches?: RecentPitchFeedRow[];
  atBatPitches?: RecentPitchFeedRow[];
};

const QUICK_PRESETS: { label: string; selections: SlipSelections }[] = [
  {
    label: "Fastball + full zone",
    selections: {
      pitchType: "Fastball",
      zonePick: { mode: "cells", cells: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    },
  },
  {
    label: "Changeup + Ball",
    selections: { pitchType: "Changeup", zonePick: { mode: "ball" } },
  },
  {
    label: "Slider + low band",
    selections: {
      pitchType: "Slider",
      zonePick: { mode: "cells", cells: [7, 8, 9] },
    },
  },
  {
    label: "Foul + Slider",
    selections: { pitchType: "Slider", battingResult: "Foul" },
  },
  {
    label: "Fastball + Ball",
    selections: { pitchType: "Fastball", zonePick: { mode: "ball" } },
  },
  {
    label: "Strike + Fastball",
    selections: { pitchType: "Fastball", battingResult: "Strike" },
  },
  {
    label: "Fastball 95-97",
    selections: { pitchType: "Fastball", velocity: "96" },
  },
  {
    label: "Ball only",
    selections: { zonePick: { mode: "ball" } },
  },
];

/**
 * Live game + next-pitch betting — dashboard layout (hero zone · slip · pitch history).
 */
export function GameClient({
  gamePk,
  demoMode = false,
}: {
  gamePk: number;
  /** Slower polling when the server simulates pitch timing (demo cookie). */
  demoMode?: boolean;
}) {
  const [data, setData] = useState<GamePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const [zonePick, setZonePick] = useState<ZonePick | null>(null);
  const [placementPhase, setPlacementPhase] =
    useState<StrikePlacementPhase>("draft");
  const [lockedZonePick, setLockedZonePick] = useState<ZonePick | null>(null);
  const [watchBetId, setWatchBetId] = useState<string | null>(null);
  const [resultActualCell, setResultActualCell] = useState<number | null>(null);
  const [ballResult, setBallResult] = useState<"win" | "lose" | null>(null);
  const fadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingBetQueueRef = useRef<string[]>([]);

  const [pitchType, setPitchType] = useState<"" | PitchType>("");
  const [velocityMph, setVelocityMph] = useState<number | null>(null);
  const [stake, setStake] = useState("1");
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [lowerOpen, setLowerOpen] = useState(false);
  const [lowerTab, setLowerTab] = useState<"feed" | "history">("feed");

  const [betWindowStartMs, setBetWindowStartMs] = useState<number | null>(null);
  const lastPlayCountRef = useRef<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  /** Bets placed during the current 15s window (for net-result calculation). */
  const windowBetsRef = useRef<
    Array<{
      id: string;
      stake: number;
      zonePick: ZonePick | null;
      odds: number;
    }>
  >([]);
  /** Pitch-result reaction state (win/loss/neutral + net amount). */
  const [pitchReaction, setPitchReaction] = useState<PitchReaction | null>(
    null,
  );
  /** Animation key for panel glow classes (incremented to re-trigger). */
  const [reactionKey, setReactionKey] = useState(0);
  /** Key to trigger "bet placed" confirmation flash on panels. */
  const [betPlacedKey, setBetPlacedKey] = useState(0);
  const [showBetPlaced, setShowBetPlaced] = useState(false);

  // IMPORTANT:
  // - Demo behavior (synthetic 15s windows, auto-resolve, demo wallet) should ONLY ever
  //   run for the explicit demo game id. All real MLB games must behave as true live mode.
  const effectiveDemo = gamePk === DEMO_GAME_ID;

  useEffect(() => {
    setZonePick(null);
    setLockedZonePick(null);
    setPlacementPhase("draft");
    setWatchBetId(null);
    setResultActualCell(null);
    setBallResult(null);
    setSlipMsg(null);
    setPlacing(false);
    setLowerOpen(false);
    setLowerTab("feed");
    windowBetsRef.current = [];
    setPitchReaction(null);
    fadeTimersRef.current.forEach(clearTimeout);
    fadeTimersRef.current = [];
  }, [gamePk]);

  const clearFadeTimers = useCallback(() => {
    fadeTimersRef.current.forEach(clearTimeout);
    fadeTimersRef.current = [];
  }, []);

  const onToggleCell = useCallback(
    (cell: number) => {
      if (placementPhase === "result" || placementPhase === "fade") return;
      setZonePick((prev) => {
        if (prev?.mode === "ball") {
          return { mode: "cells", cells: [cell] };
        }
        if (prev?.mode === "cells") {
          const set = new Set(prev.cells);
          if (set.has(cell)) set.delete(cell);
          else set.add(cell);
          const cells = [...set].sort((a, b) => a - b);
          if (cells.length === 0) return null;
          return { mode: "cells", cells };
        }
        return { mode: "cells", cells: [cell] };
      });
    },
    [placementPhase],
  );

  const onSelectBall = useCallback(() => {
    if (placementPhase === "result" || placementPhase === "fade") return;
    setZonePick((prev) => (prev?.mode === "ball" ? null : { mode: "ball" }));
  }, [placementPhase]);

  const handleBetPlaced = useCallback(
    (detail?: { betId: string; zonePick?: ZonePick | null }) => {
      setRefresh((x) => x + 1);
      if (effectiveDemo) return;

      // Live mode: allow multiple bets per pitch.
      // We do NOT lock the strike zone UI; we just enqueue bet ids so we can
      // play result animations as they settle.
      if (detail?.betId) {
        pendingBetQueueRef.current = [
          ...pendingBetQueueRef.current.filter((id) => id !== detail.betId),
          detail.betId,
        ];
        setWatchBetId((cur) => cur ?? detail.betId);
      }
    },
    [effectiveDemo],
  );

  useEffect(() => {
    if (effectiveDemo) return;
    if (!watchBetId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrlWithDemoSearch("/api/bets"), {
          credentials: "include",
          cache: "no-store",
          headers: demoModeRequestHeaders(),
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { bets?: StoredBet[] };
        const bets = Array.isArray(j.bets) ? j.bets : [];
        const bet = bets.find((b) => b.id === watchBetId);
        if (!bet || bet.status === "pending") return;
        if (cancelled) return;
        clearInterval(interval);
        // Dequeue the settled bet id and advance to the next, if any.
        pendingBetQueueRef.current = pendingBetQueueRef.current.filter(
          (id) => id !== watchBetId,
        );
        const nextId = pendingBetQueueRef.current[0] ?? null;
        setWatchBetId(nextId);

        const won = bet.status === "won";
        const zc =
          bet.outcome && "zoneCell" in bet.outcome
            ? (bet.outcome.zoneCell ?? null)
            : null;
        setResultActualCell(zc);
        const zp = bet.selections.zonePick ?? null;
        setLockedZonePick(zp);
        if (zp?.mode === "ball") {
          setBallResult(won ? "win" : "lose");
        } else {
          setBallResult(null);
        }

        // Trigger win/loss/neutral reaction for this resolved bet (live mode).
        const stake = Number(bet.stake) || 0;
        const payout = Number(bet.payout ?? 0) || 0;
        const net =
          bet.status === "won"
            ? payout - stake
            : bet.status === "lost"
              ? -stake
              : 0;
        const reactionType: PitchReaction["type"] =
          net > 0.005 ? "win" : net < -0.005 ? "loss" : "neutral";
        setPitchReaction({ type: reactionType, netAmount: net, key: Date.now() });
        setReactionKey((k) => k + 1);

        setPlacementPhase("result");

        clearFadeTimers();
        const tFade = setTimeout(() => setPlacementPhase("fade"), 4600);
        const tReset = setTimeout(() => {
          setPlacementPhase("draft");
          setLockedZonePick(null);
          setResultActualCell(null);
          setBallResult(null);
          setPitchReaction(null);
        }, 5200);
        fadeTimersRef.current.push(tFade, tReset);
      } catch {
        /* ignore */
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [watchBetId, clearFadeTimers, effectiveDemo]);

  useEffect(() => {
    return () => clearFadeTimers();
  }, [clearFadeTimers]);

  useEffect(() => {
    let cancelled = false;
    // Poll aggressively in live mode. Too-fast polling can trigger MLB throttling,
    // which ironically causes multi-second stalls; this balances freshness and stability.
    const intervalMs = effectiveDemo
      ? 900
      : gamePk === DEMO_GAME_ID
        ? 5000
        : 350;
    async function load() {
      try {
        const res = await fetch(apiUrlWithDemoSearch(`/api/game/${gamePk}`), {
          cache: "no-store",
          credentials: "include",
          headers: demoModeRequestHeaders(),
        });
        const j = (await res.json()) as GamePayload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Load failed");
        if (!cancelled) {
          setData(j);
          setErr(null);
          if (j.settledCount && j.settledCount > 0) {
            setRefresh((x) => x + 1);
          }
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    }
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [gamePk, effectiveDemo]);

  // Tick: keeps betting lock/progress feeling “live”.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(t);
  }, []);

  // Start a 15s betting window on each new pitch (demo mode only).
  useEffect(() => {
    if (!effectiveDemo) return;
    if (!data) return;
    const pc = data.playCount ?? 0;
    const prev = lastPlayCountRef.current;
    if (prev == null) {
      lastPlayCountRef.current = pc;
      setBetWindowStartMs(Date.now());
      return;
    }
    if (pc !== prev) {
      lastPlayCountRef.current = pc;
      setBetWindowStartMs(Date.now());
      setSlipMsg(null);
      windowBetsRef.current = [];
    }
  }, [data, data?.playCount, effectiveDemo]);

  const s = data?.situation ?? null;
  const recent = useMemo(
    () => data?.recentPitches ?? [],
    [data?.recentPitches],
  );
  const atBat = useMemo(() => data?.atBatPitches ?? [], [data?.atBatPitches]);
  const placementLocked =
    !effectiveDemo &&
    (placementPhase === "locked" || placementPhase === "result");

  const selections: SlipSelections = useMemo(() => {
    const sLocal: SlipSelections = {};
    if (pitchType) sLocal.pitchType = pitchType;
    if (velocityMph != null) sLocal.velocity = String(Math.round(velocityMph));
    if (zonePick) sLocal.zonePick = zonePick;
    return sLocal;
  }, [pitchType, velocityMph, zonePick]);

  const pickCount = slipLegCount(selections);
  const quote = pickCount >= 1 && pickCount <= 3 ? quoteOdds(selections) : null;
  const quickPicks = useMemo(
    () =>
      QUICK_PRESETS.map((p) => ({ ...p, quote: quoteOdds(p.selections) }))
        .sort((a, b) => b.quote.probability - a.quote.probability)
        .slice(0, 4),
    [],
  );
  const stakeNum = Number(stake);
  const payout =
    quote && Number.isFinite(stakeNum) && stakeNum > 0
      ? potentialPayout(stakeNum, quote.offeredOdds)
      : 0;

  const bettingLocked =
    effectiveDemo && betWindowStartMs != null
      ? nowMs - betWindowStartMs >= 15_000
      : false;

  const canPlace =
    !placing &&
    !bettingLocked &&
    quote != null &&
    zonePick != null &&
    Number.isFinite(stakeNum) &&
    stakeNum >= 0.1 &&
    stakeNum <= 200;

  const pitcherAvgMph = useMemo(() => {
    if (!data) return null;
    const speeds: number[] = [];
    for (const p of atBat) {
      if (p.speedMph != null && Number.isFinite(p.speedMph))
        speeds.push(p.speedMph);
    }
    for (const p of recent) {
      if (p.speedMph != null && Number.isFinite(p.speedMph))
        speeds.push(p.speedMph);
    }
    const sample = speeds.slice(0, 8);
    if (sample.length === 0) return null;
    const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
    return Number.isFinite(avg) ? avg : null;
  }, [atBat, recent, data]);

  const applyQuick = useCallback((sel: SlipSelections) => {
    setSlipMsg(null);
    setPitchType((sel.pitchType ?? "") as "" | PitchType);
    // Presets can specify bucket labels or mph strings; treat numeric as mph.
    if (sel.velocity) {
      const n = Number(sel.velocity);
      setVelocityMph(Number.isFinite(n) ? n : null);
    }
    setZonePick(sel.zonePick ?? null);
  }, []);

  const resetSelections = useCallback(() => {
    setZonePick(null);
    setPitchType("");
    setVelocityMph(null);
    setSlipMsg(null);
  }, []);

  const submitBet = useCallback(async () => {
    setSlipMsg(null);
    if (!s) {
      setSlipMsg("Loading game…");
      return;
    }
    if (!zonePick) {
      setSlipMsg("Select a zone to place a bet.");
      return;
    }
    if (!quote) {
      setSlipMsg("Pick 1–3 categories to see live pricing.");
      return;
    }
    if (effectiveDemo && bettingLocked) {
      setSlipMsg("Betting window closed — wait for the next pitch.");
      return;
    }
    if (!Number.isFinite(stakeNum) || stakeNum < 0.1 || stakeNum > 200) {
      setSlipMsg("Unit size must be between $0.10 and $200.");
      return;
    }

    setPlacing(true);
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
          gameLabel: `${s.away} @ ${s.home}`,
          pitcherName: s.pitcherName,
          batterName: s.batterName,
          scoreboardAtBet: {
            balls: s.balls,
            strikes: s.strikes,
            outs: s.outs,
            inning: s.inning,
            inningHalf: s.inningHalf,
          },
          selections,
          stake: stakeNum,
          clientDemoMode: effectiveDemo,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setSlipMsg(j.error ?? "Could not place bet.");
        return;
      }
      const bid = typeof j.bet?.id === "string" ? (j.bet.id as string) : null;
      if (bid) {
        windowBetsRef.current = [
          ...windowBetsRef.current,
          { id: bid, stake: stakeNum, zonePick, odds: quote?.offeredOdds ?? 1 },
        ];
        handleBetPlaced({ betId: bid, zonePick });
      } else {
        handleBetPlaced();
      }
      // Push updated balance to header immediately
      if (typeof j.balance === "number") {
        window.dispatchEvent(
          new CustomEvent("np:balance", { detail: j.balance }),
        );
      }
      setBetPlacedKey((k) => k + 1);
      setShowBetPlaced(true);
      setTimeout(() => setShowBetPlaced(false), 2200);
      setSlipMsg(null);
    } finally {
      setPlacing(false);
    }
  }, [
    bettingLocked,
    effectiveDemo,
    gamePk,
    handleBetPlaced,
    quote,
    s,
    selections,
    stakeNum,
    zonePick,
  ]);

  // Demo mode: resolve all pending bets exactly at window close.
  useEffect(() => {
    if (!effectiveDemo) return;
    if (betWindowStartMs == null) return;
    const remaining = Math.max(0, betWindowStartMs + 15_000 - Date.now());
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/resolve/auto", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...demoModeRequestHeaders(),
          },
          body: JSON.stringify({ gamePk, clientDemoMode: true }),
        });
        const body = await res.json();
        setRefresh((x) => x + 1);

        // Push post-settle balance to header immediately
        if (typeof body.balance === "number") {
          window.dispatchEvent(
            new CustomEvent("np:balance", { detail: body.balance }),
          );
        }

        const summary: Array<{
          id: string;
          status: string;
          stake: number;
          payout: number;
          zoneCell: number | null;
        }> = Array.isArray(body.settledSummary) ? body.settledSummary : [];

        if (summary.length > 0) {
          const totalWagered = summary.reduce((s, b) => s + b.stake, 0);
          const totalPayout = summary
            .filter((b) => b.status === "won")
            .reduce((s, b) => s + b.payout, 0);
          const net = totalPayout - totalWagered;
          const type: PitchReaction["type"] =
            net > 0.005 ? "win" : net < -0.005 ? "loss" : "neutral";

          setPitchReaction({ type, netAmount: net, key: Date.now() });
          setReactionKey((k) => k + 1);

          // Activate zone-level result display
          const firstZone = summary[0]?.zoneCell ?? null;
          setResultActualCell(firstZone);

          // Build merged locked zone pick from all window bets for result display
          const allCells = new Set<number>();
          let anyBall = false;
          for (const wb of windowBetsRef.current) {
            if (wb.zonePick?.mode === "ball") anyBall = true;
            if (wb.zonePick?.mode === "cells")
              wb.zonePick.cells.forEach((c) => allCells.add(c));
          }
          if (anyBall) {
            setLockedZonePick({ mode: "ball" });
            setBallResult(
              firstZone === null
                ? type === "win"
                  ? "win"
                  : type === "loss"
                    ? "lose"
                    : null
                : type === "loss"
                  ? "lose"
                  : null,
            );
          } else if (allCells.size > 0) {
            setLockedZonePick({
              mode: "cells",
              cells: [...allCells].sort((a, b) => a - b),
            });
            setBallResult(null);
          }

          setPlacementPhase("result");

          clearFadeTimers();
          const tFade = setTimeout(() => setPlacementPhase("fade"), 4600);
          const tReset = setTimeout(() => {
            setPlacementPhase("draft");
            setLockedZonePick(null);
            setResultActualCell(null);
            setBallResult(null);
            setPitchReaction(null);
            windowBetsRef.current = [];
            setZonePick(null);
            setPitchType("");
            setVelocityMph(null);
            setSlipMsg(null);
          }, 5200);
          fadeTimersRef.current.push(tFade, tReset);
        }
      } catch {
        /* ignore */
      }
    }, remaining + 10);
    return () => clearTimeout(t);
  }, [betWindowStartMs, effectiveDemo, gamePk, clearFadeTimers]);

  if (err || !data || !s) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/55">
          {err ?? "Loading game…"}
        </main>
      </div>
    );
  }

  const halfLabel = s.inningHalf === "bottom" ? "BOT" : "TOP";
  const scoreAway = data.score?.away ?? 0;
  const scoreHome = data.score?.home ?? 0;
  const abAway = data.teamAbbr?.away ?? s.away.slice(0, 3).toUpperCase();
  const abHome = data.teamAbbr?.home ?? s.home.slice(0, 3).toUpperCase();
  const latestPitch = recent[0] ?? null;
  // Strike-zone outcome overlay: show the most recent *real* pitch result (live) or
  // demo preview (when present). This stays out of the bet slip.
  const latestOutcome = latestPitch
    ? {
        zone:
          latestPitch.zone != null && latestPitch.zone >= 1 && latestPitch.zone <= 9
            ? `Zone ${latestPitch.zone}`
            : "Ball",
        pitchType: latestPitch.pitchType ?? "—",
        velocity:
          latestPitch.speedMph != null
            ? `${Math.round(latestPitch.speedMph)} mph`
            : "—",
      }
    : data.lastPitchPreview
      ? {
          zone: "—",
          pitchType: data.lastPitchPreview.pitchType ?? "—",
          velocity: data.lastPitchPreview.velocity ?? "—",
        }
      : null;

  const szGlowClass = pitchReaction
    ? pitchReaction.type === "win"
      ? "animate-np-sz-glow-win"
      : pitchReaction.type === "loss"
        ? "animate-np-sz-glow-loss"
        : "animate-np-sz-glow-neutral"
    : "";
  const slipGlowClass = pitchReaction
    ? pitchReaction.type === "win"
      ? "animate-np-slip-glow-win"
      : pitchReaction.type === "loss"
        ? "animate-np-slip-glow-loss"
        : "animate-np-slip-glow-neutral"
    : "";

  const placedGlowClass =
    showBetPlaced && !pitchReaction ? "animate-np-placed-glow" : "";

  return (
    <div className="h-screen overflow-hidden">
      <Header />
      <PitchResultReaction reaction={pitchReaction} />

      <main className="mx-auto flex h-[calc(100vh-46px)] max-w-[1600px] flex-col overflow-hidden px-4 py-1.5 sm:px-5 lg:px-6">
        <GameLiveHeader
          awayName={s.away}
          homeName={s.home}
          awayAbbr={abAway}
          homeAbbr={abHome}
          scoreAway={scoreAway}
          scoreHome={scoreHome}
          halfLabel={halfLabel}
          inning={s.inning}
          outs={s.outs}
          balls={s.balls}
          strikes={s.strikes}
          pitcherName={s.pitcherName}
          batterName={s.batterName}
          pitcherId={s.pitcherId ?? null}
          batterId={s.batterId ?? null}
          onFirst={s.onFirst}
          onSecond={s.onSecond}
          onThird={s.onThird}
          bettingWindow={
            effectiveDemo
              ? { startMs: betWindowStartMs, durationMs: 15_000 }
              : undefined
          }
          footer={null}
        />
        {/* Allow panel glow box-shadows to render outside their boxes (no clipping). */}
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-visible">
          {lowerOpen ? (
            <section className="np-card np-card-interactive flex min-h-0 flex-1 flex-col overflow-hidden border border-white/[0.06]">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLowerTab("feed")}
                    className={`rounded-np-control px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      lowerTab === "feed"
                        ? "border border-np-blue/35 bg-np-blue/15 text-np-text"
                        : "border border-white/[0.08] text-white/45"
                    }`}
                  >
                    Pitch feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setLowerTab("history")}
                    className={`rounded-np-control px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      lowerTab === "history"
                        ? "border border-np-blue/35 bg-np-blue/15 text-np-text"
                        : "border border-white/[0.08] text-white/45"
                    }`}
                  >
                    Bet history
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Collapse"
                  onClick={() => setLowerOpen(false)}
                  className="h-8 w-8 rounded-np-control border border-white/[0.08] text-white/55 hover:border-np-blue/35 hover:text-np-text"
                >
                  ˄
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2 [scrollbar-gutter:stable]">
                {lowerTab === "feed" ? (
                  <div className="np-card np-card-interactive min-h-0 border border-white/[0.06] p-3">
                    {recent.length === 0 ? (
                      <p className="text-xs text-white/45">
                        No pitch feed rows yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {recent.slice(0, 24).map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-3 rounded-np-control border border-white/[0.06] bg-np-panel/40 px-3 py-2"
                          >
                            <span className="text-xs text-np-text">
                              {p.pitchType}
                            </span>
                            <span className="font-mono text-xs text-white/55">
                              {p.speedMph != null
                                ? `${p.speedMph.toFixed(0)} mph`
                                : "— mph"}
                            </span>
                            <span className="text-xs text-white/45">
                              {p.callText}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <BetHistory refreshKey={refresh} embedded />
                )}
              </div>
            </section>
          ) : (
            <>
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <section
                  key={`sz-${reactionKey}-${betPlacedKey}`}
                  className={`np-card np-card-interactive col-span-12 flex min-h-0 flex-col overflow-hidden p-3 xl:col-span-8 ${szGlowClass} ${placedGlowClass}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                        Strike zone
                      </h2>
                      <span className="rounded-full border border-np-cyan/30 bg-np-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-cyan">
                        Live
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/50">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Foul
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-np-success" />
                        Strike
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-np-danger" />
                        Ball
                      </span>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-np-control bg-[linear-gradient(180deg,rgba(8,15,30,0.94),rgba(5,10,22,0.94))]">
                    <StrikeZoneCanvas
                      pitches={atBat}
                      className="h-full"
                      betMarker={null}
                      mapPulseAwaitingPitch={
                        !effectiveDemo && placementPhase === "locked"
                      }
                      placement={{
                        phase: placementPhase,
                        draftPick: zonePick,
                        lockedPick: lockedZonePick,
                        resultActualCell,
                        ballResult,
                        onToggleCell,
                        onSelectBall,
                      }}
                    />
                    {latestOutcome ? (
                      <div className="pointer-events-none absolute inset-x-4 bottom-3 z-[40] flex justify-between text-[11px] text-white/60">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-white/45">Zone</span>
                            <span className="text-np-text">
                              {latestOutcome.zone}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-white/45">Pitch type</span>
                            <span className="text-np-text">
                              {latestOutcome.pitchType}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-white/45">Velocity</span>
                            <span className="text-np-text">
                              {latestOutcome.velocity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section
                  key={`slip-${reactionKey}-${betPlacedKey}`}
                  className={`np-card np-card-interactive col-span-12 flex min-h-0 h-full flex-col overflow-hidden p-2.5 [contain:layout_paint] xl:col-span-4 ${slipGlowClass} ${placedGlowClass}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                      Bet slip
                    </h2>
                    <button
                      type="button"
                      onClick={resetSelections}
                      className="rounded-np-control border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 transition hover:border-np-blue/35 hover:text-np-text"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <div className="min-h-0 shrink-0 border-t border-white/[0.06] pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                        Quick picks
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {quickPicks.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            disabled={effectiveDemo && bettingLocked}
                            onClick={() => applyQuick(p.selections)}
                            className="rounded-np-control border border-white/[0.08] bg-np-panel/55 px-2.5 py-1.5 text-left transition hover:border-np-blue/40 hover:bg-np-blue/10 disabled:opacity-40"
                          >
                            <p className="text-[10px] text-np-text">
                              {p.label}
                            </p>
                            <p className="mt-0.5 font-mono text-xs font-semibold text-np-cyan">
                              {p.quote.offeredOdds.toFixed(1)}x
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <div className="mb-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Zone</span>
                          <span className="text-np-text">
                            {zonePick
                              ? zonePick.mode === "ball"
                                ? "Ball"
                                : zonePick.cells.length === 9
                                  ? "Full zone"
                                  : `Zone ${zonePick.cells.join(", ")}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Pitch type</span>
                          <span
                            className={
                              pitchType ? "text-np-text" : "text-white/30"
                            }
                          >
                            {pitchType || "Any"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/45">Velocity</span>
                          <span
                            className={
                              velocityMph != null
                                ? "text-np-text"
                                : "text-white/30"
                            }
                          >
                            {velocityMph != null
                              ? `${Math.round(velocityMph)} mph`
                              : "Any"}
                          </span>
                        </div>
                      </div>
                      <label className="text-[11px] text-white/45">
                        Unit size
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0.1}
                        max={200}
                        className="np-input mt-1 font-mono"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                      />

                      <div className="mt-2 rounded-np-control border border-white/[0.06] bg-black/35 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/45">Odds</span>
                          <span className="font-mono text-base font-semibold text-np-cyan">
                            {quote ? `${quote.offeredOdds.toFixed(2)}x` : "—"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-white/45">Payout</span>
                          <span className="font-mono text-sm font-semibold text-np-success">
                            {quote ? `$${payout.toFixed(2)}` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pt-2">
                    <button
                      type="button"
                      onClick={() => void submitBet()}
                      disabled={!canPlace}
                      className="np-btn-primary w-full py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40"
                    >
                      {placing ? "Placing…" : "Place bet"}
                    </button>
                  </div>
                </section>
              </div>

              <div className="grid shrink-0 grid-cols-12 gap-3">
                <VelocitySlider
                  value={velocityMph}
                  onChange={setVelocityMph}
                  pitcherAvgMph={pitcherAvgMph}
                  disabled={effectiveDemo && bettingLocked}
                  className="col-span-12 h-[116px] xl:col-span-8"
                />
                <PitchTypeWheel
                  value={pitchType}
                  onChange={setPitchType}
                  disabled={effectiveDemo && bettingLocked}
                  className="col-span-12 h-[116px] xl:col-span-4"
                />
              </div>
            </>
          )}

          {!lowerOpen ? (
            <section className="np-card np-card-interactive shrink-0 border border-white/[0.06] px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLowerTab("feed");
                      setLowerOpen(true);
                    }}
                    className="rounded-np-control border border-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 hover:border-np-blue/35 hover:text-np-text"
                  >
                    Pitch feed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLowerTab("history");
                      setLowerOpen(true);
                    }}
                    className="rounded-np-control border border-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 hover:border-np-blue/35 hover:text-np-text"
                  >
                    Bet history
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Expand workspace"
                  onClick={() => setLowerOpen(true)}
                  className="h-8 w-8 rounded-np-control border border-white/[0.08] text-white/55 hover:border-np-blue/35 hover:text-np-text"
                >
                  ˅
                </button>
              </div>
            </section>
          ) : null}
        </div>
        <div className="mt-1 h-4 shrink-0 text-center text-[11px] text-white/55">
          {slipMsg ?? ""}
        </div>
      </main>
    </div>
  );
}
