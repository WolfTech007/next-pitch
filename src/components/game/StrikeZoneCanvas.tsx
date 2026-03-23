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
  /** Subtle pulse while a slip is locked and we await the next pitch. */
  mapPulseAwaitingPitch?: boolean;
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
  mapPulseAwaitingPitch = false,
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
        <linearGradient id={`szFill-${filterId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12203a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#070d18" stopOpacity="0.82" />
        </linearGradient>
        {/*
          No feGaussianBlur on the zone fill: blur expands the paint bounds and the root SVG
          clips to viewBox, so the fill looked shifted vs. unfiltered grid lines.
        */}
      </defs>
      {/* Soft outer rim light */}
      <rect
        x={SZ.x - 0.35}
        y={SZ.y - 0.35}
        width={SZ.w + 0.7}
        height={SZ.h + 0.7}
        rx="0.75"
        fill="none"
        stroke="rgba(37, 99, 255, 0.14)"
        strokeWidth="0.85"
        opacity={0.95}
        pointerEvents="none"
      />
      <rect
        x={SZ.x}
        y={SZ.y}
        width={SZ.w}
        height={SZ.h}
        rx="0.6"
        fill={`url(#szFill-${filterId})`}
        stroke="rgba(0, 207, 255, 0.22)"
        strokeWidth="0.75"
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
      <g pointerEvents="none" opacity={0.55} stroke="rgba(37, 99, 255, 0.38)" strokeWidth="1.05">
        <line x1={SZ_V1} y1={SZ.y} x2={SZ_V1} y2={SZ.y + SZ.h} strokeLinecap="round" />
        <line x1={SZ_V2} y1={SZ.y} x2={SZ_V2} y2={SZ.y + SZ.h} strokeLinecap="round" />
        <line x1={SZ.x} y1={SZ_H1} x2={SZ.x + SZ.w} y2={SZ_H1} strokeLinecap="round" />
        <line x1={SZ.x} y1={SZ_H2} x2={SZ.x + SZ.w} y2={SZ_H2} strokeLinecap="round" />
      </g>
      <g pointerEvents="none" stroke="rgba(186, 230, 253, 0.32)" strokeWidth="0.32">
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

  const pulseClass =
    mapPulseAwaitingPitch && placement ? "animate-np-pulse border-np-blue/25" : "";

  return (
    <div
      className={`np-card np-card-interactive flex h-full min-h-0 flex-col p-5 shadow-np-card transition-[box-shadow,border-color] duration-300 ${pulseClass} ${className}`}
    >
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Strike zone
          </h2>
          {placement ? (
            <span className="rounded-full border border-np-cyan/30 bg-np-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-cyan">
              Live
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-white/50">
          This at-bat only · Statcast location when available
        </p>
        {placement ? (
          <p className="mt-2 text-[10px] leading-relaxed text-white/45">
            Click squares inside the zone for coverage, or click{" "}
            <span className="text-np-blue-bright/90">anywhere else on this pitch map</span> for a
            ball (pitch not in zones 1–9). Click again to clear, or pick a zone square to switch.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-np-danger" /> Ball
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-np-success" /> Strike
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Foul
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/35" /> Other
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
            className={`relative flex-1 min-h-[240px] w-full lg:min-h-[300px] ${fadeWrap}`}
          >
            <svg
              ref={mapSvgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              overflow="visible"
              shapeRendering="geometricPrecision"
              className="pointer-events-none absolute inset-0 z-10 block h-full w-full overflow-visible"
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
            overflow="visible"
            className="mx-auto aspect-square w-full max-w-[520px] flex-1 basis-[min(100%,520px)] min-h-[300px] max-h-[min(560px,calc(100vh-220px))] lg:min-h-[380px] overflow-visible"
            role="img"
            aria-label="Strike zone — current at-bat pitch locations"
          >
            {mapSvgInner}
          </svg>
        )}
      </div>
      {pitches.length === 0 ? (
        <p className="shrink-0 pb-1 text-center text-[11px] text-white/40">
          No pitches in this plate appearance yet.
        </p>
      ) : null}
    </div>
  );
}
