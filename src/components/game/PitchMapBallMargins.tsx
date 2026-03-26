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
  const svgW = svg.clientWidth;
  const svgH = svg.clientHeight;
  if (svgW < 1 || svgH < 1) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
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
  mapContainerRef: RefObject<HTMLDivElement | null>;
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
 * Four strips + continuous gradient offsets; map container uses overflow-hidden + rounded corners
 * so the outer “ball zone” matches the panel radius.
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
  const [containerHeight, setContainerHeight] = useState(0);
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
    setContainerHeight(container.clientHeight);
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
    // Base fallback fill for the ball area when not actively selected.
    if (hoverOutside && interactive) {
      return { backgroundColor: "rgba(37, 99, 255, 0.22)" };
    }
    return { backgroundColor: "rgba(6, 11, 22, 0.55)" };
  }

  const pe = interactive ? "auto" : "none";
  const style = bgStyle();
  const cursor = interactive ? "pointer" : "default";

  const stripStyle = (extra: CSSProperties, topOffsetPx = 0): CSSProperties => {
    const ballGradientDraft =
      "linear-gradient(180deg, rgba(75,143,255,0.96) 0%, rgba(37,99,235,0.94) 52%, rgba(29,78,216,0.92) 100%)";
    const ballGradientLocked =
      "linear-gradient(180deg, rgba(75,143,255,0.56) 0%, rgba(37,99,235,0.54) 52%, rgba(29,78,216,0.52) 100%)";
    const h = Math.max(1, containerHeight);
    const base: CSSProperties = {
      position: "absolute",
      ...extra,
      ...style,
      pointerEvents: pe,
      cursor,
      transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
    };

    // When the ball area is the active selection, drive its look here so it never
    // turns into a flat black rectangle:
    if (ballActive) {
      // While drafting / locked and also during the brief moment *before* we know
      // win/lose, keep the bright blue gradient so there is never a dark flash.
      if (!showResult || !ballResult) {
        return {
          ...base,
          backgroundImage:
            phase === "locked" ? ballGradientLocked : ballGradientDraft,
          backgroundSize: `100% ${h}px`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: `0 ${-topOffsetPx}px`,
        };
      }

      // On result: solid green for win, red for loss, no opacity tricks.
      if (ballResult === "win") {
        return {
          ...base,
          backgroundColor: "rgb(21 128 61)",
        };
      }
      if (ballResult === "lose") {
        return {
          ...base,
          backgroundColor: "rgb(185 28 28)",
        };
      }
    }

    return base;
  };

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
            style={stripStyle(
              {
                left: 0,
                top: 0,
                right: 0,
                height: `${holePx!.top}px`,
              },
              0,
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: 0,
                top: `${holePx!.top + holePx!.height}px`,
                right: 0,
                bottom: 0,
              },
              holePx!.top + holePx!.height,
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: 0,
                top: `${holePx!.top}px`,
                width: `${holePx!.left}px`,
                height: `${holePx!.height}px`,
              },
              holePx!.top,
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: `${holePx!.left + holePx!.width}px`,
                top: `${holePx!.top}px`,
                right: 0,
                height: `${holePx!.height}px`,
              },
              holePx!.top,
            )}
            {...commonHandlers}
          />
        </>
      ) : (
        <>
          <div
            style={stripStyle(
              { left: 0, top: 0, width: "100%", height: `${pt}%` },
              0,
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: 0,
                top: `${bottomTopPct}%`,
                width: "100%",
                height: `${100 - bottomTopPct}%`,
              },
              (bottomTopPct / 100) * Math.max(1, containerHeight),
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: 0,
                top: `${pt}%`,
                width: `${pl}%`,
                height: `${ph}%`,
              },
              (pt / 100) * Math.max(1, containerHeight),
            )}
            {...commonHandlers}
          />
          <div
            style={stripStyle(
              {
                left: `${pl + pw}%`,
                top: `${pt}%`,
                width: `${100 - pl - pw}%`,
                height: `${ph}%`,
              },
              (pt / 100) * Math.max(1, containerHeight),
            )}
            {...commonHandlers}
          />
        </>
      )}
    </div>
  );
}
