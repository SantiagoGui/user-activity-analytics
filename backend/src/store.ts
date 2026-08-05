import type { ActivityEvent, LoadResult } from './types';

/** First index in `arr` whose timestampMs is >= target (lower bound). */
function bisectLeft(arr: ActivityEvent[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]!.timestampMs < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index in `arr` whose timestampMs is > target (exclusive upper bound). */
function bisectRight(arr: ActivityEvent[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]!.timestampMs <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** `arr` must be sorted ascending by timestampMs. O(log n) instead of a full scan per query. */
function sliceRange(arr: ActivityEvent[], startMs?: number, endMs?: number): ActivityEvent[] {
  const from = startMs === undefined ? 0 : bisectLeft(arr, startMs);
  const to = endMs === undefined ? arr.length : bisectRight(arr, endMs);
  if (from >= to) return [];
  return arr.slice(from, to);
}

/**
 * In-memory activity store, indexed by user_id.
 *
 * Shape: Map<user_id, events[]>, each user's events kept sorted ascending by
 * timestamp. This is built once per successful /load and then read many times:
 *   - /summary and /sessions need one user's events, in time order -> O(1) map
 *     lookup + O(log n) binary search for the start/end of a time range.
 *   - /action_trends and /anomalies need every user's events -> iterate the map's
 *     values (one binary-search range per user, not a full re-scan of all rows).
 * At the data sizes this app targets (<=5000 rows, <=125 users), a full per-user
 * array scan would already be fast enough, but binary search costs nothing extra
 * to write and keeps the approach correct if the row count grows.
 */
class ActivityStore {
  private eventsByUser: Map<number, ActivityEvent[]> = new Map();
  private loaded = false;
  private lastLoadResult: LoadResult | null = null;

  replaceData(events: ActivityEvent[], result: LoadResult): void {
    const next = new Map<number, ActivityEvent[]>();
    for (const event of events) {
      let bucket = next.get(event.userId);
      if (!bucket) {
        bucket = [];
        next.set(event.userId, bucket);
      }
      bucket.push(event);
    }
    for (const bucket of next.values()) {
      bucket.sort((a, b) => a.timestampMs - b.timestampMs);
    }
    // Only swapped in on success, so a failed reload never clobbers good data.
    this.eventsByUser = next;
    this.loaded = true;
    this.lastLoadResult = result;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getLastLoadResult(): LoadResult | null {
    return this.lastLoadResult;
  }

  hasUser(userId: number): boolean {
    return this.eventsByUser.has(userId);
  }

  /** Returns undefined if the user has no events at all (distinct from an empty range). */
  getUserEventsInRange(userId: number, startMs?: number, endMs?: number): ActivityEvent[] | undefined {
    const bucket = this.eventsByUser.get(userId);
    if (!bucket) return undefined;
    return sliceRange(bucket, startMs, endMs);
  }

  /** All users' events restricted to the given time range, keyed by user_id. */
  getAllUsersEventsInRange(startMs?: number, endMs?: number): Map<number, ActivityEvent[]> {
    const out = new Map<number, ActivityEvent[]>();
    for (const [userId, bucket] of this.eventsByUser) {
      const slice = sliceRange(bucket, startMs, endMs);
      if (slice.length > 0) out.set(userId, slice);
    }
    return out;
  }

  /** Every known user_id with its total event count, sorted ascending by
   *  user_id — a new endpoint with no prior ordering to preserve, and
   *  ascending is the natural contract for something powering an autocomplete. */
  listUserCounts(): { userId: number; count: number }[] {
    return Array.from(this.eventsByUser.entries())
      .map(([userId, bucket]) => ({ userId, count: bucket.length }))
      .sort((a, b) => a.userId - b.userId);
  }
}

export { ActivityStore };
