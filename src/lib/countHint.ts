/**
 * Simple, rule-based copy for the slip — not a real pitch-mix model.
 */
export function countBasedHint(balls: number, strikes: number): string {
  if (balls === 3 && strikes === 2) return "3–2 count — fastball often.";
  if (strikes === 2 && balls === 2) return "Even 2–2 — mixed sequencing.";
  if (balls === 3 && strikes < 2) return "Pitcher behind — chase pitch / breaking ball possible.";
  if (strikes === 2 && balls < 2) return "Pitcher ahead — put-away breaking pitch common.";
  if (strikes === 0 && balls === 0) return "First pitch — often a strike-getter in the zone.";
  return "Live count — watch for sequencing off the last few pitches.";
}
