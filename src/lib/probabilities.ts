import probabilities from "../../data/probabilities.json";
import type {
  BattingResult,
  LocationBucket,
  PitchType,
  SlipSelections,
  VelocityBucket,
  VelocityPick,
  ZonePick,
} from "./markets";

/**
 * Load per-bucket priors from `data/probabilities.json`.
 * `combinedProbability` adjusts multi-leg slips — same-pitch props are correlated, not independent.
 */

type ProbFile = {
  pitchType: Record<string, number>;
  velocity: Record<string, number>;
  location: Record<string, number>;
  zoneCells?: Record<string, number>;
  battingResult?: Record<string, number>;
};

const file = probabilities as ProbFile;

/**
 * Same pitch: type / vel / zone are strongly correlated (e.g. FB + in-zone is far more common
 * than independence implies). Each extra leg multiplies the naive product by (1 + this) once
 * per additional leg — materially shortens “obvious” combos like fastball + in zone.
 */
const SAME_PITCH_CORR_PER_EXTRA_LEG = 0.68;
/** Cap so long-shot parlays still pay meaningful multiples; avoids absurd “99%” implied singles. */
const MAX_COMBINED_IMPLIED_PROB = 0.84;

export function getPitchTypeProb(p: PitchType): number {
  return file.pitchType[p] ?? 0.2;
}

export function getVelocityProb(v: VelocityBucket): number {
  return file.velocity[v] ?? 0.2;
}

function mphVelocityProb(mph: number): number {
  // Approx P(|V - mph| <= 1). We model V ~ N(92, 4.3) as a global prior.
  // This keeps pricing stable while UI can still show a matchup-tuned gradient.
  const mu = 92;
  const sigma = 4.3;
  const z1 = (mph - 1 - mu) / sigma;
  const z2 = (mph + 1 - mu) / sigma;
  // Normal CDF approximation (Abramowitz-Stegun style) for smooth odds.
  const cdf = (z: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    const base = z >= 0 ? 1 - p : p;
    return Math.max(0, Math.min(1, base));
  };
  const prob = cdf(z2) - cdf(z1);
  return Math.max(1e-6, Math.min(0.6, prob));
}

export function getVelocityPickProb(v: VelocityPick): number {
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== "") {
    return mphVelocityProb(n);
  }
  return getVelocityProb(v as VelocityBucket);
}

export function getLocationProb(l: LocationBucket): number {
  return file.location[l] ?? 0.17;
}

export function getBattingResultProb(r: BattingResult): number {
  return file.battingResult?.[r] ?? 0.25;
}

function zoneCellPrior(cell: number): number {
  const zc = file.zoneCells;
  if (!zc) return 0.47 / 9;
  return zc[String(cell)] ?? 0.47 / 9;
}

/** Sum of priors for Statcast cells 1–9 (≈ pitch lands inside the 3×3 grid). */
export function sumInZoneCellPriors(): number {
  const zc = file.zoneCells;
  if (!zc) return 0.47;
  let s = 0;
  for (let i = 1; i <= 9; i++) s += zc[String(i)] ?? 0;
  return Math.max(0.15, Math.min(0.85, s));
}

/**
 * P(pitch resolves outside cells 1–9) — used for “Ball” placement pick.
 * Complement of in-box cell priors so multi-select and ball stay coherent.
 */
export function getOutsideZonePlacementProb(): number {
  return Math.max(0.12, Math.min(0.88, 1 - sumInZoneCellPriors()));
}

/** Union probability for multi-cell selection (pitch lands in any chosen cell). */
export function getZonePickProbability(z: ZonePick): number {
  if (z.mode === "ball") return getOutsideZonePlacementProb();
  let s = 0;
  for (const c of z.cells) s += zoneCellPrior(c);
  return Math.max(s, 1e-6);
}

/**
 * Implied chance all selected buckets hit on the **same** next pitch.
 * Applies a small correlation uplift for 2–3 legs (tighter than naive independence).
 */
export function combinedProbability(selections: SlipSelections): number {
  let p = 1;
  let legs = 0;
  if (selections.pitchType) {
    p *= getPitchTypeProb(selections.pitchType);
    legs++;
  }
  if (selections.velocity) {
    p *= getVelocityPickProb(selections.velocity);
    legs++;
  }
  if (selections.zonePick) {
    p *= getZonePickProbability(selections.zonePick);
    legs++;
  } else if (selections.location) {
    p *= getLocationProb(selections.location);
    legs++;
  }
  if (selections.battingResult) {
    p *= getBattingResultProb(selections.battingResult);
    legs++;
  }
  if (legs >= 2) {
    p *= 1 + SAME_PITCH_CORR_PER_EXTRA_LEG * (legs - 1);
  }
  p = Math.min(p, MAX_COMBINED_IMPLIED_PROB);
  return Math.max(p, 1e-6);
}
