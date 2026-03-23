import type { HomeGameCardViewModel } from "@/lib/homeGameCard";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function firstPitchHintEt(rng: () => number): string {
  const hour24 = 18 + Math.floor(rng() * 4);
  const minuteChoices = [5, 7, 10, 15, 20, 35, 40, 42];
  const minute = minuteChoices[Math.floor(rng() * minuteChoices.length)]!;
  const h12 = hour24 > 12 ? hour24 - 12 : hour24;
  const mm = minute.toString().padStart(2, "0");
  return `First pitch · ${h12}:${mm} PM ET`;
}

/**
 * Re-skins completed schedule rows so the home board looks like live games / pre-games,
 * not a finished slate (demo mode only).
 */
export function decorateDemoHomeCards(
  cards: HomeGameCardViewModel[],
): HomeGameCardViewModel[] {
  return cards.map((card) => {
    const rng = mulberry32(card.gamePk * 0xbeefcafe);
    const roll = rng();

    if (roll < 0.13) {
      return {
        ...card,
        inningLabel: "Pre-game",
        statusHint: firstPitchHintEt(rng),
        balls: 0,
        strikes: 0,
        outs: 0,
        onFirst: false,
        onSecond: false,
        onThird: false,
        away: {
          ...card.away,
          runs: 0,
          hits: 0,
          errors: 0,
        },
        home: {
          ...card.home,
          runs: 0,
          hits: 0,
          errors: 0,
        },
        hideGamePkFooter: true,
      };
    }

    const inning = 2 + Math.floor(rng() * 7);
    const bottom = rng() > 0.48;
    const half = bottom ? "BOT" : "TOP";
    const balls = Math.min(3, Math.floor(rng() * 4));
    const strikes = Math.min(2, Math.floor(rng() * 3));
    const outs = Math.min(2, Math.floor(rng() * 3));

    const ar = Math.min(12, Math.floor(rng() * 8));
    const hr = Math.min(12, Math.floor(rng() * 8));
    const hitsAway = ar + Math.floor(rng() * 7);
    const hitsHome = hr + Math.floor(rng() * 7);

    return {
      ...card,
      inningLabel: `${half} ${inning}`,
      statusHint: undefined,
      balls,
      strikes,
      outs,
      onFirst: rng() > 0.66,
      onSecond: rng() > 0.8,
      onThird: rng() > 0.9,
      away: {
        ...card.away,
        runs: ar,
        hits: hitsAway,
        errors: Math.min(2, Math.floor(rng() * 3)),
      },
      home: {
        ...card.home,
        runs: hr,
        hits: hitsHome,
        errors: Math.min(2, Math.floor(rng() * 3)),
      },
      hideGamePkFooter: true,
    };
  });
}
