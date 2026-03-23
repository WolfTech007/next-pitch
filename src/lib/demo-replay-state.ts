import type { StoreData } from "@/lib/store";

/** Wait after a demo bet before advancing one pitch in the replay. */
export const DEMO_REPLAY_ADVANCE_DELAY_MS = 5_000;

export type DemoReplayCell = {
  pitchIndex: number;
  /** When set, advance one pitch once `Date.now() >= advanceAtMs` (set when a bet is placed). */
  advanceAtMs: number | null;
};

function key(gamePk: number): string {
  return String(gamePk);
}

export function getDemoReplayState(store: StoreData, gamePk: number): DemoReplayCell {
  const k = key(gamePk);
  const row = store.demoReplayByGamePk?.[k];
  return row ?? { pitchIndex: 0, advanceAtMs: null };
}

/** Call after a demo bet is recorded: next poll after 5s may advance one pitch. */
export function scheduleDemoAdvanceAfterBet(store: StoreData, gamePk: number): void {
  if (!store.demoReplayByGamePk) store.demoReplayByGamePk = {};
  const k = key(gamePk);
  const cur = getDemoReplayState(store, gamePk);
  store.demoReplayByGamePk[k] = {
    pitchIndex: cur.pitchIndex,
    advanceAtMs: Date.now() + DEMO_REPLAY_ADVANCE_DELAY_MS,
  };
}

export type ApplyDemoAdvanceResult = { changed: boolean; pitchIndex: number };

/**
 * If a bet scheduled an advance and the delay has passed, move forward one pitch (capped).
 */
export function applyDemoReplayAdvanceIfDue(
  store: StoreData,
  gamePk: number,
  maxPitchIndex: number,
): ApplyDemoAdvanceResult {
  if (!store.demoReplayByGamePk) store.demoReplayByGamePk = {};
  const k = key(gamePk);
  let { pitchIndex, advanceAtMs } = getDemoReplayState(store, gamePk);
  let changed = false;
  if (advanceAtMs != null && Date.now() >= advanceAtMs) {
    pitchIndex = Math.min(pitchIndex + 1, Math.max(0, maxPitchIndex));
    advanceAtMs = null;
    changed = true;
  }
  store.demoReplayByGamePk[k] = { pitchIndex, advanceAtMs };
  return { changed, pitchIndex };
}
