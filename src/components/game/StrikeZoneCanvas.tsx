"use client";

import { useId, useRef } from "react";
import type { RecentPitchFeedRow } from "@/lib/mlb";
import type { ZonePick } from "@/lib/markets";
import { PitchMapBallMargins } from "./PitchMapBallMargins";
import {
  StrikeZonePlacementLayer,
  type StrikePlacementPhase,
} from "./StrikeZonePlacementLayer";

export type BetZoneMarkerProps = {
  x: number;
  y: number;
  phase: "pending" | "win" | "lose";
};

export type StrikeZonePlacementProps = {
  phase: StrikePlacementPhase;
  draftPick: ZonePick | null;
  lockedPick: ZonePick | null;
  resultActualCell: number | null;
  ballResult: "win" | "lose" | null;
  onToggleCell: (cell: number) => void;
  onSelectBall: () => void;
};

type Props = {
  /** Current plate appearance only, most recent first. */
  pitches: RecentPitchFeedRow[];
  className?: string;
  /** Optional slip location pick — white ring while pending, green/red glow + fade when settled. */
  betMarker?: BetZoneMarkerProps | null;
  /** Interactive strike-zone placement (game page only). */
  placement?: StrikeZonePlacementProps | null;
};

/** MLB-style portrait strike zone in viewBox 0–100 (matches `mlb.ts` SZ_*). */
const SZ = { x: 24, y: 14, w: 52, h: 70 };
const SZ_V1 = SZ.x + SZ.w / 3;
const SZ_V2 = SZ.x + (2 * SZ.w) / 3;
const SZ_H1 = SZ.y + SZ.h / 3;
const SZ_H2 = SZ.y + (2 * SZ.h) / 3;

function dotFill(r: RecentPitchFeedRow["countResult"]): string {
  switch (r) {
    case "ball":
      return "#ef4444";
    case "strike":
      return "#22c55e";
    case "foul":
      return "#eab308";
    default:
      return "#71717a";
  }
}

/**
 * Large strike-zone view — dots colored by ball / strike / foul for this at-bat only.
 * Optional 3×3 placement grid + full-tab “outside strike zone” click for Ball.
 */
export function StrikeZoneCanvas({
  pitches,
  className = "",
  betMarker = null,
  placement = null,
}: Props) {
  const filterId = useId().replace(/:/g, "");
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const chronological = [...(pitches ?? [])].reverse();

  const fadeWrap =
    placement?.phase === "fade"
      ? "opacity-0 transition-opacity duration-[450ms] ease-out"
      : "opacity-100 transition-opacity duration-300 ease-out";

  const mapSvgInner = (
    <>
      <defs>
        <filter id={`szGlow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x={SZ.x}
        y={SZ.y}
        width={SZ.w}
        height={SZ.h}
        rx="0.6"
        fill="rgb(24 24 27 / 0.55)"
        stroke="rgb(113 113 122)"
        strokeWidth="1"
        filter={`url(#szGlow-${filterId})`}
        pointerEvents="none"
      />
      {placement ? (
        <StrikeZonePlacementLayer
          phase={placement.phase}
          draftPick={placement.draftPick}
          lockedPick={placement.lockedPick}
          resultActualCell={placement.resultActualCell}
          onToggleCell={placement.onToggleCell}
        />
      ) : null}
      <g pointerEvents="none" stroke="rgb(63 63 70 / 0.55)" strokeWidth="0.45">
        <line x1={SZ_V1} y1={SZ.y} x2={SZ_V1} y2={SZ.y + SZ.h} />
        <line x1={SZ_V2} y1={SZ.y} x2={SZ_V2} y2={SZ.y + SZ.h} />
        <line x1={SZ.x} y1={SZ_H1} x2={SZ.x + SZ.w} y2={SZ_H1} />
        <line x1={SZ.x} y1={SZ_H2} x2={SZ.x + SZ.w} y2={SZ_H2} />
      </g>
      {chronological.map((p, i) => {
        const isLast = i === chronological.length - 1;
        const fill = dotFill(p.countResult);
        const pitchNo = i + 1;
        const fontSize = pitchNo > 9 ? (isLast ? 3 : 2.5) : isLast ? 3.9 : 3.1;
        return (
          <g key={p.id} pointerEvents="none">
            <circle
              cx={p.plotX}
              cy={p.plotY}
              r={isLast ? 4.2 : 3.2}
              fill={fill}
              fillOpacity={isLast ? 1 : 0.88}
              stroke="rgb(9 9 11)"
              strokeWidth="0.5"
            />
            <text
              x={p.plotX}
              y={p.plotY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={fontSize}
              fontWeight={700}
              fontFamily="ui-monospace, system-ui, sans-serif"
            >
              {pitchNo}
            </text>
          </g>
        );
      })}
      {betMarker ? (
        <circle
          key={betMarker.phase}
          cx={betMarker.x}
          cy={betMarker.y}
          r={6.75}
          fill="none"
          strokeWidth={1.35}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          className={
            betMarker.phase === "pending"
              ? "stroke-white"
              : betMarker.phase === "win"
                ? "animate-bet-marker-win"
                : "animate-bet-marker-lose"
          }
        />
      ) : null}
    </>
  );

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-xl border border-zinc-800/90 bg-gradient-to-b from-zinc-950 to-black p-4 ${className}`}
    >
      <div className="shrink-0">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Pitch map
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          This at-bat only · Statcast location when available
        </p>
        {placement ? (
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            Click squares inside the zone for coverage, or click{" "}
            <span className="text-zinc-400">anywhere else on this pitch map</span> for a ball (pitch
            not in zones 1–9). Click again to clear, or pick a zone square to switch.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Ball
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Strike
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-500" /> Foul
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-500" /> Other
          </span>
        </div>
      </div>

      <div
        className={
          placement
            ? "relative mt-3 flex min-h-0 flex-1 flex-col px-1 pb-1"
            : "relative mt-3 flex min-h-0 flex-1 items-center justify-center px-1 pb-1"
        }
      >
        {placement ? (
          <div
            ref={mapAreaRef}
            className={`relative flex-1 min-h-[280px] w-full lg:min-h-[360px] ${fadeWrap}`}
          >
            <svg
              ref={mapSvgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 z-10 block h-full w-full"
              role="img"
              aria-label="Strike zone — current at-bat pitch locations"
            >
              {mapSvgInner}
            </svg>
            <PitchMapBallMargins
              mapContainerRef={mapAreaRef}
              svgRef={mapSvgRef}
              phase={placement.phase}
              draftPick={placement.draftPick}
              lockedPick={placement.lockedPick}
              resultActualCell={placement.resultActualCell}
              ballResult={placement.ballResult}
              onSelectBall={placement.onSelectBall}
            />
          </div>
        ) : (
          <svg
            viewBox="0 0 100 100"
            className="mx-auto aspect-square w-full max-w-[520px] flex-1 basis-[min(100%,520px)] min-h-[300px] max-h-[min(560px,calc(100vh-220px))] lg:min-h-[380px]"
            role="img"
            aria-label="Strike zone — current at-bat pitch locations"
          >
            {mapSvgInner}
          </svg>
        )}
      </div>
      {pitches.length === 0 ? (
        <p className="shrink-0 pb-1 text-center text-[11px] text-zinc-600">
          No pitches in this plate appearance yet.
        </p>
      ) : null}
    </div>
  );
}
