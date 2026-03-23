"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiUrlWithDemoSearch,
  demoModeRequestHeaders,
  isClientDemoMode,
} from "@/lib/demo-mode-client";
import { BetHistory } from "@/components/BetHistory";
import { BetPanel } from "@/components/BetPanel";
import { GameLiveHeader } from "@/components/game/GameLiveHeader";
import { PitchFeedList } from "@/components/game/PitchFeedList";
import { StrikeZoneCanvas } from "@/components/game/StrikeZoneCanvas";
import { Header } from "@/components/Header";
import type { GameSituation, RecentPitchFeedRow } from "@/lib/mlb";
import type { StoredBet } from "@/lib/store";
import type { ZonePick } from "@/lib/markets";
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
  const [placementPhase, setPlacementPhase] = useState<StrikePlacementPhase>("draft");
  const [lockedZonePick, setLockedZonePick] = useState<ZonePick | null>(null);
  const [watchBetId, setWatchBetId] = useState<string | null>(null);
  const [resultActualCell, setResultActualCell] = useState<number | null>(null);
  const [ballResult, setBallResult] = useState<"win" | "lose" | null>(null);
  const fadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [clientDemo, setClientDemo] = useState(false);
  useEffect(() => {
    setClientDemo(isClientDemoMode());
  }, []);
  const effectiveDemo = demoMode || clientDemo;

  useEffect(() => {
    setZonePick(null);
    setLockedZonePick(null);
    setPlacementPhase("draft");
    setWatchBetId(null);
    setResultActualCell(null);
    setBallResult(null);
    fadeTimersRef.current.forEach(clearTimeout);
    fadeTimersRef.current = [];
  }, [gamePk]);

  const clearFadeTimers = useCallback(() => {
    fadeTimersRef.current.forEach(clearTimeout);
    fadeTimersRef.current = [];
  }, []);

  const onToggleCell = useCallback((cell: number) => {
    if (placementPhase !== "draft") return;
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
  }, [placementPhase]);

  const onSelectBall = useCallback(() => {
    if (placementPhase !== "draft") return;
    setZonePick((prev) => (prev?.mode === "ball" ? null : { mode: "ball" }));
  }, [placementPhase]);

  const handleBetPlaced = useCallback(
    (detail?: { betId: string; zonePick?: ZonePick | null }) => {
      setRefresh((x) => x + 1);
      if (detail?.zonePick) {
        setLockedZonePick(detail.zonePick);
        setPlacementPhase("locked");
        setWatchBetId(detail.betId);
      }
    },
    [],
  );

  useEffect(() => {
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
        setWatchBetId(null);

        const won = bet.status === "won";
        const zc =
          bet.outcome && "zoneCell" in bet.outcome ? (bet.outcome.zoneCell ?? null) : null;
        setResultActualCell(zc);
        const zp = bet.selections.zonePick;
        if (zp?.mode === "ball") {
          setBallResult(won ? "win" : "lose");
        } else {
          setBallResult(null);
        }
        setPlacementPhase("result");

        clearFadeTimers();
        const tFade = setTimeout(() => setPlacementPhase("fade"), 5000);
        const tReset = setTimeout(() => {
          setPlacementPhase("draft");
          setLockedZonePick(null);
          setZonePick(null);
          setResultActualCell(null);
          setBallResult(null);
        }, 5400);
        fadeTimersRef.current.push(tFade, tReset);
      } catch {
        /* ignore */
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [watchBetId, clearFadeTimers]);

  useEffect(() => {
    return () => clearFadeTimers();
  }, [clearFadeTimers]);

  useEffect(() => {
    let cancelled = false;
    const intervalMs = effectiveDemo
      ? 4000
      : gamePk === DEMO_GAME_ID
        ? 5000
        : 750;
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

  if (err || !data) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/55">
          {err ?? "Loading game…"}
        </main>
      </div>
    );
  }

  const s = data.situation;
  const halfLabel = s.inningHalf === "bottom" ? "BOT" : "TOP";
  const scoreAway = data.score?.away ?? 0;
  const scoreHome = data.score?.home ?? 0;
  const abAway = data.teamAbbr?.away ?? s.away.slice(0, 3).toUpperCase();
  const abHome = data.teamAbbr?.home ?? s.home.slice(0, 3).toUpperCase();
  const recent = data.recentPitches ?? [];
  const atBat = data.atBatPitches ?? [];

  const placementLocked = placementPhase === "locked" || placementPhase === "result";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5 lg:px-6 lg:py-7">
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
          footer={
            <p className="text-[11px] text-white/45">
              {data.feedSource === "linescore" ? (
                <>
                  Linescore mode — full pitch map when the rich live feed is available.
                </>
              ) : (
                <>Play-by-play connected — pending slips auto-settle on the next pitch.</>
              )}
            </p>
          }
        />

        <div className="mt-5 grid grid-cols-12 gap-5 lg:gap-6">
          <div className="col-span-12 min-h-[360px] xl:col-span-7">
            <StrikeZoneCanvas
              pitches={atBat}
              className="min-h-0 lg:h-full"
              betMarker={null}
              mapPulseAwaitingPitch={placementPhase === "locked"}
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
          </div>
          <div className="col-span-12 flex min-h-0 xl:col-span-5">
            <BetPanel
              gamePk={gamePk}
              demoWalletActive={effectiveDemo}
              gameLabel={`${s.away} @ ${s.home}`}
              pitcherName={s.pitcherName}
              batterName={s.batterName}
              balls={s.balls}
              strikes={s.strikes}
              scoreboardAtBet={{
                balls: s.balls,
                strikes: s.strikes,
                outs: s.outs,
                inning: s.inning,
                inningHalf: s.inningHalf,
              }}
              zonePick={zonePick}
              onZonePickChange={(z) => {
                if (placementLocked) return;
                setZonePick(z);
              }}
              placementLocked={placementLocked}
              onPlaced={handleBetPlaced}
              className="min-h-0 w-full lg:h-full"
            />
          </div>
          <div className="col-span-12 min-h-0">
            <PitchFeedList pitches={recent} className="min-h-0 w-full" />
          </div>
        </div>

        <details
          open
          className="np-card group mt-6 overflow-hidden border border-white/[0.06] open:border-np-blue/20"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-np-text transition hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
            <span className="uppercase tracking-[0.2em] text-[11px] text-white/45">
              Bet history
            </span>
            <span className="text-white/40 transition group-open:rotate-180">▼</span>
          </summary>
          <div className="border-t border-white/[0.06] bg-black/20 pb-2">
            <BetHistory refreshKey={refresh} embedded />
          </div>
        </details>
      </main>
    </div>
  );
}
