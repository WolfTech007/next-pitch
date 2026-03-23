"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { ZonePick } from "@/lib/markets";
import type { StrikePlacementPhase } from "./StrikeZonePlacementLayer";

/** Same as `StrikeZoneCanvas` / viewBox 0–100. */
const SZ = { x: 24, y: 14, w: 52, h: 70 };

/** Fallback when pixel measure isn’t ready yet (matches a full-bleed `meet` SVG in a square box). */
const SZ_PCT = { left: 24, top: 14, w: 52, h: 70 };

export type StrikeZoneHolePx = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function computeStrikeZoneHolePx(
  container: HTMLElement,
  svg: SVGSVGElement,
): StrikeZoneHolePx {
  const containerRect = container.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const svgW = svgRect.width;
  const svgH = svgRect.height;
  const s = Math.min(svgW / 100, svgH / 100);
  const ox = (svgW - 100 * s) / 2;
  const oy = (svgH - 100 * s) / 2;
  return {
    left: svgRect.left - containerRect.left + ox + SZ.x * s,
    top: svgRect.top - containerRect.top + oy + SZ.y * s,
    width: SZ.w * s,
    height: SZ.h * s,
  };
}

function holePxValid(h: StrikeZoneHolePx | null): h is StrikeZoneHolePx {
  return h != null && h.width > 0.5 && h.height > 0.5;
}

type Props = {
  /** Wrapper that fills the pitch map tab body; must be `position: relative`. */
  mapContainerRef: RefObject<HTMLDivElement | null>;
  /** The pitch-map `<svg>` (viewBox 0–100) — used for accurate `meet` alignment. */
  svgRef: RefObject<SVGSVGElement | null>;
  phase: StrikePlacementPhase;
  draftPick: ZonePick | null;
  lockedPick: ZonePick | null;
  resultActualCell: number | null;
  ballResult: "win" | "lose" | null;
  onSelectBall: () => void;
};

/**
 * Full pitch-map tab (the map container) minus the on-screen strike-zone rectangle.
 * Pixel geometry tracks the SVG’s `meet` scaling; until layout is ready, % fallback keeps Ball usable.
 */
export function PitchMapBallMargins({
  mapContainerRef,
  svgRef,
  phase,
  draftPick,
  lockedPick,
  resultActualCell,
  ballResult,
  onSelectBall,
}: Props) {
  const [holePx, setHolePx] = useState<StrikeZoneHolePx | null>(null);
  const [hoverOutside, setHoverOutside] = useState(false);

  const interactive = phase === "draft";
  const display = phase === "draft" ? draftPick : lockedPick;
  const selectedCells =
    display?.mode === "cells" ? new Set(display.cells) : new Set<number>();
  const ballActive = display?.mode === "ball";
  const showResult = phase === "result" || phase === "fade";

  const updateHole = useCallback(() => {
    const container = mapContainerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width < 1 || svgRect.height < 1) return;
    const next = computeStrikeZoneHolePx(container, svg);
    if (next.width > 0.5 && next.height > 0.5) {
      setHolePx(next);
    }
  }, [mapContainerRef, svgRef]);

  useLayoutEffect(() => {
    let cancelled = false;
    updateHole();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) updateHole();
      });
    });

    const container = mapContainerRef.current;
    const svg = svgRef.current;
    const ro = new ResizeObserver(() => updateHole());
    if (container) ro.observe(container);
    if (svg) ro.observe(svg);
    window.addEventListener("resize", updateHole);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener("resize", updateHole);
    };
  }, [updateHole, mapContainerRef, svgRef]);

  function bgStyle(): CSSProperties {
    if (showResult) {
      if (ballActive && ballResult === "win") {
        return {
          backgroundColor: "rgb(21 128 61)",
          opacity: phase === "fade" ? 0.22 : 0.55,
        };
      }
      if (ballActive && ballResult === "lose") {
        return {
          backgroundColor: "rgb(185 28 28)",
          opacity: phase === "fade" ? 0.18 : 0.5,
        };
      }
      if (!ballActive && resultActualCell === null && selectedCells.size > 0) {
        return {
          backgroundColor: "rgb(21 128 61)",
          opacity: phase === "fade" ? 0.15 : 0.4,
        };
      }
      return { opacity: 0 };
    }
    if (ballActive) {
      if (phase === "locked") {
        return { backgroundColor: "#1d4ed8", opacity: 0.35 };
      }
      return { backgroundColor: "#1e40af", opacity: 0.55 };
    }
    if (hoverOutside && interactive) {
      return { backgroundColor: "rgb(212 212 216)", opacity: 0.28 };
    }
    return { backgroundColor: "rgb(0 0 0)", opacity: 0.04 };
  }

  const pe = interactive ? "auto" : "none";
  const style = bgStyle();
  const cursor = interactive ? "pointer" : "default";

  const stripStyle = (extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    ...extra,
    ...style,
    pointerEvents: pe,
    cursor,
  });

  const usePx = holePxValid(holePx);
  const { left: pl, top: pt, w: pw, h: ph } = SZ_PCT;
  const bottomTopPct = pt + ph;

  const commonHandlers = {
    onMouseEnter: () => interactive && setHoverOutside(true),
    onMouseLeave: () => interactive && setHoverOutside(false),
    onClick: () => interactive && onSelectBall(),
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {usePx ? (
        <>
          <div
            style={stripStyle({
              left: 0,
              top: 0,
              right: 0,
              height: `${holePx!.top}px`,
            })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: 0,
              top: `${holePx!.top + holePx!.height}px`,
              right: 0,
              bottom: 0,
            })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: 0,
              top: `${holePx!.top}px`,
              width: `${holePx!.left}px`,
              height: `${holePx!.height}px`,
            })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: `${holePx!.left + holePx!.width}px`,
              top: `${holePx!.top}px`,
              right: 0,
              height: `${holePx!.height}px`,
            })}
            {...commonHandlers}
          />
        </>
      ) : (
        <>
          <div
            style={stripStyle({ left: 0, top: 0, width: "100%", height: `${pt}%` })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: 0,
              top: `${bottomTopPct}%`,
              width: "100%",
              height: `${100 - bottomTopPct}%`,
            })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: 0,
              top: `${pt}%`,
              width: `${pl}%`,
              height: `${ph}%`,
            })}
            {...commonHandlers}
          />
          <div
            style={stripStyle({
              left: `${pl + pw}%`,
              top: `${pt}%`,
              width: `${100 - pl - pw}%`,
              height: `${ph}%`,
            })}
            {...commonHandlers}
          />
        </>
      )}
    </div>
  );
}
