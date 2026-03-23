/**
 * MVP market definitions — fixed buckets for the prototype.
 * These labels are what the user picks on the slip.
 */

export const PITCH_TYPES = [
  "Fastball",
  "Slider",
  "Curveball",
  "Changeup",
  "Other",
] as const;

export const VELOCITY_BUCKETS = [
  "Under 85",
  "85-89",
  "90-94",
  "95-97",
  "98+",
] as const;

export const LOCATION_BUCKETS = [
  "In Zone",
  "Ball",
  "Up",
  "Down",
  "Inside",
  "Outside",
] as const;

/** Umpire / count outcome of the pitch (fair ball for a hit vs ball/strike/foul). */
export const BAT_RESULT_BUCKETS = ["Hit", "Ball", "Strike", "Foul"] as const;

export type PitchType = (typeof PITCH_TYPES)[number];
export type VelocityBucket = (typeof VELOCITY_BUCKETS)[number];
export type LocationBucket = (typeof LOCATION_BUCKETS)[number];
export type BattingResult = (typeof BAT_RESULT_BUCKETS)[number];

/** Interactive strike-zone placement (mutually exclusive with legacy `location`). */
export type ZonePick =
  | { mode: "ball" }
  | { mode: "cells"; cells: number[] };

/** What the user can attach to a slip (1–3 picks). */
export type SlipSelections = {
  pitchType?: PitchType;
  velocity?: VelocityBucket;
  /** Legacy bucket — do not combine with `zonePick`. */
  location?: LocationBucket;
  battingResult?: BattingResult;
  zonePick?: ZonePick;
};

/** How many prop legs are active (zone placement OR legacy location, never both). */
export function slipLegCount(s: SlipSelections): number {
  let n = 0;
  if (s.pitchType) n++;
  if (s.velocity) n++;
  if (s.battingResult) n++;
  if (s.zonePick) n++;
  else if (s.location) n++;
  return n;
}

export function isValidBattingResult(s: string): s is BattingResult {
  return (BAT_RESULT_BUCKETS as readonly string[]).includes(s);
}

export function parseZonePick(raw: unknown): ZonePick | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (r.mode === "ball") return { mode: "ball" };
  if (r.mode === "cells" && Array.isArray(r.cells)) {
    const cells = [...new Set(r.cells.map((c) => Number(c)).filter((n) => n >= 1 && n <= 9))].sort(
      (a, b) => a - b,
    );
    if (cells.length < 1) return undefined;
    return { mode: "cells", cells };
  }
  return undefined;
}

/** Slip summary line for history / UI (spec: “Custom” for any zone multi-select). */
export function formatZonePickLabel(z: ZonePick | undefined): string | undefined {
  if (!z) return undefined;
  if (z.mode === "ball") return "Ball";
  return "Custom";
}
