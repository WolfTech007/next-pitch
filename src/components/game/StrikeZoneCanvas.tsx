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

function dotStroke(r: RecentPitchFeedRow["countResult"]): string {
  switch (r) {
    case "ball":
      return "rgba(255, 55, 85, 0.98)";
    case "strike":
      return "rgba(0, 255, 163, 0.98)";
    case "foul":
      return "rgba(255, 214, 0, 0.98)";
    default:
      return "rgba(147, 197, 253, 0.55)";
  }
}

function dotGlow(r: RecentPitchFeedRow["countResult"]): string {
  switch (r) {
    case "ball":
      return "rgba(255, 55, 85, 0.38)";
    case "strike":
      return "rgba(0, 255, 163, 0.34)";
    case "foul":
      return "rgba(255, 214, 0, 0.3)";
    default:
      return "rgba(37, 99, 255, 0.22)";
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

  const pitchDotsAndBetMarker = (
    <>
      {chronological.map((p, i) => {
        const isLast = i === chronological.length - 1;
        const stroke = dotStroke(p.countResult);
        const glow = dotGlow(p.countResult);
        const pitchNo = i + 1;
        const fontSize = pitchNo > 9 ? (isLast ? 3 : 2.5) : isLast ? 3.9 : 3.1;
        const r = isLast ? 4.05 : 3.05;
        const outerGlow = `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 18px ${glow})`;
        return (
          <g
            key={p.id}
            pointerEvents="none"
            className={isLast ? "np-tron-pop" : ""}
            style={{ filter: isLast ? outerGlow : `drop-shadow(0 0 8px ${glow})` }}
          >
            {/* thin neon ring */}
            <circle
              cx={p.plotX}
              cy={p.plotY}
              r={r}
              fill="transparent"
              stroke={stroke}
              strokeWidth={1.05}
              opacity={isLast ? 1 : 0.88}
            />
            {/* lock-in dash overlay (latest pitch only) */}
            {isLast ? (
              <circle
                cx={p.plotX}
                cy={p.plotY}
                r={r}
                fill="transparent"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={0.6}
                className="np-tron-lock"
              />
            ) : null}
            {/* subtle inner rim to feel glassy, still transparent */}
            <circle
              cx={p.plotX}
              cy={p.plotY}
              r={Math.max(1, r - 0.8)}
              fill="transparent"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={0.55}
              opacity={isLast ? 0.75 : 0.45}
            />
            <text
              x={p.plotX}
              y={p.plotY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(255,255,255,0.96)"
              fontSize={fontSize}
              fontWeight={720}
              fontFamily="ui-monospace, system-ui, sans-serif"
              style={{
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.6)",
                strokeWidth: 0.85,
                filter: `drop-shadow(0 0 6px ${glow})`,
              }}
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

  const mapSvgInner = (
    <>
      <defs>
        <linearGradient id={`szFill-${filterId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.01)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
        </linearGradient>
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
        stroke="rgba(72, 164, 255, 0.45)"
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
      <g
        pointerEvents="none"
        opacity={0.9}
        stroke="rgba(72, 164, 255, 0.45)"
        strokeWidth="0.9"
      >
        <line
          x1={SZ_V1}
          y1={SZ.y}
          x2={SZ_V1}
          y2={SZ.y + SZ.h}
          strokeLinecap="round"
        />
        <line
          x1={SZ_V2}
          y1={SZ.y}
          x2={SZ_V2}
          y2={SZ.y + SZ.h}
          strokeLinecap="round"
        />
        <line
          x1={SZ.x}
          y1={SZ_H1}
          x2={SZ.x + SZ.w}
          y2={SZ_H1}
          strokeLinecap="round"
        />
        <line
          x1={SZ.x}
          y1={SZ_H2}
          x2={SZ.x + SZ.w}
          y2={SZ_H2}
          strokeLinecap="round"
        />
      </g>
      {placement ? null : pitchDotsAndBetMarker}
    </>
  );

  const pulseClass =
    mapPulseAwaitingPitch && placement
      ? "animate-np-pulse border-np-blue/25"
      : "";

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col transition-[box-shadow,border-color] duration-300 ${pulseClass} ${className}`}
    >
      <div
        className={
          placement
            ? "relative flex min-h-0 flex-1 flex-col px-1 pb-1"
            : "relative flex min-h-0 flex-1 items-center justify-center px-1 pb-1"
        }
      >
        {placement ? (
          <div
            ref={mapAreaRef}
            className="relative flex-1 h-full min-h-[320px] w-full overflow-hidden rounded-np-control"
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
            {/* Above ball-margin overlay (z-20) so pitches outside the zone stay visible */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              overflow="visible"
              shapeRendering="geometricPrecision"
              className="pointer-events-none absolute inset-0 z-[30] block h-full w-full overflow-visible"
              aria-hidden
            >
              {pitchDotsAndBetMarker}
            </svg>
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
      {/* keep panel clean; no bottom helper copy */}
    </div>
  );
}
