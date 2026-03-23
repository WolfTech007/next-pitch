import { promises as fs } from "fs";
import path from "path";
import {
  hasKvStorage,
  isVercelProductionFilesystem,
  MISSING_REDIS_MESSAGE,
} from "@/lib/server/has-kv-storage";
import { getRedis } from "@/lib/server/redis";
import type { ZonePick } from "./markets";

/**
 * Per-user JSON “database” for fake balance + bet history.
 * Each account has `data/user-data/{userId}.json`.
 */

export type BetStatus = "pending" | "won" | "lost";

/** Snapshot of inning + count when the slip was placed — detects new pitches even when our bucket labels match the last pitch. */
export type ScoreboardSnapshot = {
  balls: number;
  strikes: number;
  outs: number;
  inning: number;
  inningHalf: "top" | "bottom";
};

export type StoredBet = {
  id: string;
  gamePk: number;
  gameLabel: string;
  /** Snapshot when the slip was placed (for history fine print). */
  pitcherNameAtBet?: string;
  batterNameAtBet?: string;
  /** What the user tried to predict */
  selections: {
    pitchType?: string;
    velocity?: string;
    location?: string;
    battingResult?: string;
    zonePick?: ZonePick;
  };
  stake: number;
  probability: number;
  offeredOdds: number;
  status: BetStatus;
  createdAt: string;
  resolvedAt?: string;
  /** Snapshot of what “actually happened” for this pitch (demo or parsed feed) */
  outcome?: {
    pitchType?: string;
    velocity?: string;
    /** Statcast mph when known — history shows this instead of the velocity bucket. */
    speedMph?: number;
    location?: string;
    battingResult?: string;
    /** Statcast 1–9 or omitted when outside / ball for placement. */
    zoneCell?: number | null;
  };
  payout?: number;
  /** Snapshot of the last parsed pitch when the bet was placed (detects new pitches in the same at-bat). */
  pitchSignatureAtBet?: string | null;
  /** Coarse fallback: number of “plays” in the feed when the bet was placed. */
  playCountAtBet?: number;
  /** Inning + count when the slip was placed (from live feed or UI). */
  scoreboardAtBet?: ScoreboardSnapshot;
};

export type StoreData = {
  balance: number;
  defaultUnitSize: number;
  bets: StoredBet[];
};

export function defaultStoreData(): StoreData {
  return {
    balance: 1000,
    defaultUnitSize: 1,
    bets: [],
  };
}

function kvStoreKey(userId: string): string {
  return `np_user_store_v1:${userId}`;
}

function userStorePath(userId: string): string {
  return path.join(process.cwd(), "data", "user-data", `${userId}.json`);
}

async function ensureUserDataDir(): Promise<void> {
  await fs.mkdir(path.join(process.cwd(), "data", "user-data"), { recursive: true });
}

/**
 * Load one user’s store; creates `defaultStoreData()` on first access.
 */
export async function readStore(userId: string): Promise<StoreData> {
  if (hasKvStorage()) {
    try {
      const raw = await getRedis().get<string>(kvStoreKey(userId));
      if (raw) {
        return JSON.parse(raw) as StoreData;
      }
    } catch {
      /* fall through to initial */
    }
    const initial = defaultStoreData();
    await writeStore(userId, initial);
    return initial;
  }
  if (isVercelProductionFilesystem()) {
    throw new Error(MISSING_REDIS_MESSAGE);
  }
  await ensureUserDataDir();
  const p = userStorePath(userId);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    const initial = defaultStoreData();
    await writeStore(userId, initial);
    return initial;
  }
}

export async function writeStore(userId: string, data: StoreData): Promise<void> {
  if (hasKvStorage()) {
    await getRedis().set(kvStoreKey(userId), JSON.stringify(data));
    return;
  }
  if (isVercelProductionFilesystem()) {
    throw new Error(MISSING_REDIS_MESSAGE);
  }
  await ensureUserDataDir();
  const p = userStorePath(userId);
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}
