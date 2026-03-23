"use client";

import { useState } from "react";
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

type Props = {
  phase: StrikePlacementPhase;
  draftPick: ZonePick | null;
  lockedPick: ZonePick | null;
  resultActualCell: number | null;
  onToggleCell: (cell: number) => void;
};

/**
 * Strike zone: 3×3 cells. “Ball” is handled by `PitchMapBallMargins` (full tab minus the on-screen
 * strike-zone rectangle, aligned to the SVG’s meet scaling).
 */
export function StrikeZonePlacementLayer({
  phase,
  draftPick,
  lockedPick,
  resultActualCell,
  onToggleCell,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = phase === "draft";
  const display = phase === "draft" ? draftPick : lockedPick;
  const selectedCells =
    display?.mode === "cells" ? new Set(display.cells) : new Set<number>();
  const ballActive = display?.mode === "ball";
  const showResult = phase === "result" || phase === "fade";

  function styleForCell(idx: number): { fill: string; fillOpacity: number } {
    if (showResult) {
      const isActual = resultActualCell === idx;
      const wasPicked = selectedCells.has(idx);
      if (isActual) {
        return { fill: "#15803d", fillOpacity: phase === "fade" ? 0.35 : 0.88 };
      }
      if (wasPicked) {
        return { fill: "#b91c1c", fillOpacity: phase === "fade" ? 0.28 : 0.78 };
      }
      return { fill: "transparent", fillOpacity: 0 };
    }
    if (ballActive) {
      // Keep cells hoverable while Ball is selected so the user can switch to a zone square.
      if (interactive && hover === idx) {
        return { fill: "#d4d4d8", fillOpacity: 0.38 };
      }
      return { fill: "transparent", fillOpacity: 0 };
    }
    const picked = selectedCells.has(idx);
    const hov = hover === idx;
    if (picked) {
      if (phase === "locked") {
        return { fill: "#1d4ed8", fillOpacity: 0.5 };
      }
      return { fill: "#1e40af", fillOpacity: 0.78 };
    }
    if (hov && interactive) {
      return { fill: "#d4d4d8", fillOpacity: 0.38 };
    }
    return { fill: "rgb(0 0 0)", fillOpacity: 0.07 };
  }

  return (
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
            stroke="rgb(82 82 91 / 0.35)"
            strokeWidth={0.4}
            style={{
              cursor: interactive ? "pointer" : "default",
              pointerEvents: interactive ? "auto" : "none",
            }}
            onMouseEnter={() => interactive && setHover(idx)}
            onMouseLeave={() => setHover(null)}
            onClick={() => interactive && onToggleCell(idx)}
          />
        );
      })}
    </g>
  );
}
