"use client";

import { useId, useState } from "react";
import type { ZonePick } from "@/lib/markets";

/** Matches `StrikeZoneCanvas` / MLB Statcast 1–9 (top row 1–3, middle 4–6, bottom 7–9). */
const SZ = { x: 24, y: 14, w: 52, h: 70 };

export type StrikePlacementPhase = "draft" | "locked" | "result" | "fade";

function cellRect(idx: number) {
  const col = (idx - 1) % 3;
  const row = Math.floor((idx - 1) / 3);
  const cw = SZ.w / 3;
  const ch = SZ.h / 3;
  return { x: SZ.x + col * cw, y: SZ.y + row * ch, w: cw, h: ch };
}

const TRANSITION =
  "fill 180ms cubic-bezier(0.4, 0, 0.2, 1), fill-opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke-opacity 180ms cubic-bezier(0.4, 0, 0.2, 1)";

type Props = {
  phase: StrikePlacementPhase;
  draftPick: ZonePick | null;
  lockedPick: ZonePick | null;
  resultActualCell: number | null;
  onToggleCell: (cell: number) => void;
};

/**
 * Strike zone: 3×3 cells — tactile states (blue signal / green win / red miss).
 */
export function StrikeZonePlacementLayer({
  phase,
  draftPick,
  lockedPick,
  resultActualCell,
  onToggleCell,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const gradPick = `np-tile-pick-${uid}`;
  const gradLock = `np-tile-lock-${uid}`;

  const [hover, setHover] = useState<number | null>(null);
  const interactive = phase === "draft";
  const display = phase === "draft" ? draftPick : lockedPick;
  const selectedCells =
    display?.mode === "cells" ? new Set(display.cells) : new Set<number>();
  const ballActive = display?.mode === "ball";
  const showResult = phase === "result" || phase === "fade";

  function styleForCell(idx: number): {
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
  } {
    if (showResult) {
      const isActual = resultActualCell === idx;
      const wasPicked = selectedCells.has(idx);
      if (isActual) {
        return {
          fill: "#22c55e",
          fillOpacity: phase === "fade" ? 0.35 : 0.9,
          stroke: "rgba(34, 197, 94, 0.85)",
          strokeOpacity: 1,
        };
      }
      if (wasPicked) {
        return {
          fill: "#ef4444",
          fillOpacity: phase === "fade" ? 0.26 : 0.82,
          stroke: "rgba(239, 68, 68, 0.75)",
          strokeOpacity: 1,
        };
      }
      return { fill: "transparent", fillOpacity: 0, stroke: "transparent", strokeOpacity: 0 };
    }
    if (ballActive) {
      if (interactive && hover === idx) {
        return {
          fill: "rgba(37, 99, 255, 0.32)",
          fillOpacity: 1,
          stroke: "rgba(0, 207, 255, 0.48)",
          strokeOpacity: 1,
        };
      }
      return {
        fill: "transparent",
        fillOpacity: 0,
        stroke: "rgba(59, 130, 246, 0.18)",
        strokeOpacity: 1,
      };
    }
    const picked = selectedCells.has(idx);
    const hov = hover === idx;
    if (picked) {
      if (phase === "locked") {
        return {
          fill: `url(#${gradLock})`,
          fillOpacity: 1,
          stroke: "rgba(147, 197, 253, 0.38)",
          strokeOpacity: 1,
        };
      }
      return {
        fill: `url(#${gradPick})`,
        fillOpacity: 1,
        stroke: "rgba(0, 207, 255, 0.5)",
        strokeOpacity: 1,
      };
    }
    if (hov && interactive) {
      return {
        fill: "rgba(37, 99, 255, 0.3)",
        fillOpacity: 1,
        stroke: "rgba(0, 207, 255, 0.45)",
        strokeOpacity: 1,
      };
    }
    return {
      fill: "#0b1220",
      fillOpacity: 0.94,
      stroke: "rgba(255, 255, 255, 0.07)",
      strokeOpacity: 1,
    };
  }

  return (
    <>
      <defs>
        <linearGradient id={gradPick} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b8fff" stopOpacity="0.96" />
          <stop offset="52%" stopColor="#2563eb" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={gradLock} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b5cff" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#172554" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <g>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
        const { x, y, w, h } = cellRect(idx);
        const st = styleForCell(idx);
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={st.fill}
            fillOpacity={st.fillOpacity}
            stroke={st.stroke}
            strokeOpacity={st.strokeOpacity}
            strokeWidth={0.55}
            rx={0.35}
            style={{
              cursor: interactive ? "pointer" : "default",
              pointerEvents: interactive ? "auto" : "none",
              transition: TRANSITION,
            }}
            onMouseEnter={() => interactive && setHover(idx)}
            onMouseLeave={() => setHover(null)}
            onClick={() => interactive && onToggleCell(idx)}
          />
        );
      })}
      </g>
    </>
  );
}
