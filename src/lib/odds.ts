import type { SlipSelections } from "./markets";
import { combinedProbability } from "./probabilities";

/**
 * Vegas-style pricing (simplified):
 * 1) Implied win probability = product of bucket priors from `data/probabilities.json`, with a
 *    correlation bump when multiple legs are on the same pitch (see `combinedProbability`).
 * 2) Fair decimal odds ≈ 1 / p.
 * 3) Offered odds = fair × OFFERED_VS_FAIR (house edge / vig — you keep ~8% vs fair).
 * 4) Floor at MIN_OFFERED_DECIMAL so favorites still pay a visible multiple.
 */
const OFFERED_VS_FAIR = 0.92;

/** Do not quote below this decimal multiple (keeps tiny favs from paying pennies). */
const MIN_OFFERED_DECIMAL = 1.03;

export type OddsQuote = {
  /** Implied probability of all legs hitting (after correlation tweak in `combinedProbability`). */
  probability: number;
  /** Fair decimal odds = 1 / probability */
  fairOdds: number;
  /** What we show / use for payout (spread vs fair) */
  offeredOdds: number;
  /** Same as offered odds for display (“multiplier”) */
  multiplier: number;
};

/**
 * Build a quote: fair from calibrated/implied p, then apply a tight spread.
 */
export function quoteOdds(selections: SlipSelections): OddsQuote {
  const probability = combinedProbability(selections);
  const safeP = Math.max(probability, 1e-6);
  const fairOdds = 1 / safeP;
  const offeredOdds = Math.max(MIN_OFFERED_DECIMAL, fairOdds * OFFERED_VS_FAIR);
  return {
    probability,
    fairOdds,
    offeredOdds,
    multiplier: offeredOdds,
  };
}

export function potentialPayout(stake: number, offeredOdds: number): number {
  return stake * offeredOdds;
}
