import type { ActivityEvent } from './types';

export interface UserSummary {
  user_id: number;
  total_actions: number;
  most_frequent_action: string;
  avg_duration: number;
  most_frequent_page: string;
}

export interface TrendPair {
  user_id: number;
  action: string;
  count: number;
}

/** Map preserves insertion order, and we insert in chronological (per-user sorted)
 *  order, so the first key to reach the max count is deterministically the
 *  earliest-occurring one — a stable, well-defined tie-break instead of relying on
 *  incidental object-key iteration order. */
function mostFrequentKey(counts: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/** `events` must be non-empty (caller distinguishes "no data" as a 404 before calling this). */
export function computeUserSummary(userId: number, events: ActivityEvent[]): UserSummary {
  const actionCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  let durationSum = 0;

  for (const event of events) {
    actionCounts.set(event.action, (actionCounts.get(event.action) ?? 0) + 1);
    pageCounts.set(event.metadata.page, (pageCounts.get(event.metadata.page) ?? 0) + 1);
    durationSum += event.metadata.duration;
  }

  return {
    user_id: userId,
    total_actions: events.length,
    most_frequent_action: mostFrequentKey(actionCounts),
    avg_duration: Math.round((durationSum / events.length) * 100) / 100,
    most_frequent_page: mostFrequentKey(pageCounts),
  };
}

/** Top N (user_id, action) pairs by frequency across the given users' events.
 *  Ties broken by first-seen order: Array.sort is stable (guaranteed since ES2019),
 *  and pairs are inserted in the store's user-iteration order (first CSV appearance)
 *  then chronological order within a user, so equal counts keep that deterministic order. */
export function computeActionTrends(usersEvents: Map<number, ActivityEvent[]>, topN: number): TrendPair[] {
  const counts = new Map<string, TrendPair>();

  for (const [userId, events] of usersEvents) {
    for (const event of events) {
      const key = `${userId}:${event.action}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { user_id: userId, action: event.action, count: 1 });
      }
    }
  }

  const all = Array.from(counts.values());
  all.sort((a, b) => b.count - a.count);
  return all.slice(0, topN);
}
