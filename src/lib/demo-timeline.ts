import {
  collectDemoTimelinePitchesFromFeed,
  fetchLiveFeed,
  type DemoTimelinePitch,
} from "@/lib/mlb";

const cache = new Map<
  number,
  { feed: unknown; timeline: DemoTimelinePitch[]; at: number }
>();
const TTL_MS = 12 * 60 * 1000;

/**
 * Cached `feed/live` + chronological pitch list for demo replay / settlement.
 * Completed games are immutable — long TTL is safe.
 */
export async function loadDemoFeedAndTimeline(gamePk: number): Promise<{
  feed: unknown | null;
  timeline: DemoTimelinePitch[];
}> {
  const hit = cache.get(gamePk);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { feed: hit.feed, timeline: hit.timeline };
  }
  const feed = await fetchLiveFeed(gamePk);
  if (!feed) {
    return { feed: null, timeline: [] };
  }
  const timeline = collectDemoTimelinePitchesFromFeed(feed);
  cache.set(gamePk, { feed, timeline, at: Date.now() });
  return { feed, timeline };
}

export async function loadDemoTimeline(gamePk: number): Promise<DemoTimelinePitch[]> {
  const { timeline } = await loadDemoFeedAndTimeline(gamePk);
  return timeline;
}
