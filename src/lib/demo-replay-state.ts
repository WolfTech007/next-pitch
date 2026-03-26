import type { StoreData } from "@/lib/store";

/** Continuous demo loop interval (one pitch every 15 seconds). */
export const DEMO_REPLAY_ADVANCE_DELAY_MS = 15_000;

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

/** Keep for compatibility; demo loop advances continuously regardless of bets. */
export function scheduleDemoAdvanceAfterBet(store: StoreData, gamePk: number): void {
  if (!store.demoReplayByGamePk) store.demoReplayByGamePk = {};
  const k = key(gamePk);
  const cur = getDemoReplayState(store, gamePk);
  store.demoReplayByGamePk[k] = {
    pitchIndex: cur.pitchIndex,
    advanceAtMs: cur.advanceAtMs ?? Date.now() + DEMO_REPLAY_ADVANCE_DELAY_MS,
  };
}

export type ApplyDemoAdvanceResult = { changed: boolean; pitchIndex: number };

/**
 * Continuous replay loop: if timer is unset, initialize; when due, advance one pitch and re-arm.
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
  if (advanceAtMs == null) {
    advanceAtMs = Date.now() + DEMO_REPLAY_ADVANCE_DELAY_MS;
    changed = true;
  }
  if (advanceAtMs != null && Date.now() >= advanceAtMs) {
    pitchIndex = Math.min(pitchIndex + 1, Math.max(0, maxPitchIndex));
    advanceAtMs = Date.now() + DEMO_REPLAY_ADVANCE_DELAY_MS;
    changed = true;
  }
  store.demoReplayByGamePk[k] = { pitchIndex, advanceAtMs };
  return { changed, pitchIndex };
}
