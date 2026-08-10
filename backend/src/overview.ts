import type { ActivityEvent } from './types';
import type { ActionCount, ActivityBucket, BucketSize, Overview, UserCount } from 'activity-analytics-shared-types';
import { bucketStartMs, nextBucketMs } from './buckets';
import { msToIso } from './shared/time';
import { OVERVIEW_TOP_N } from './config';

/**
 * Dataset-level aggregation over an already range-filtered slice.
 *
 * `usersEvents` comes straight from ActivityStore.getAllUsersEventsInRange(), so
 * the range filtering and the per-user chronological ordering are already done;
 * this walks each user's slice exactly once.
 */
export function computeOverview(usersEvents: Map<number, ActivityEvent[]>, bucket: BucketSize): Overview {
  const actionCounts = new Map<string, number>();
  const userCounts = new Map<number, number>();
  const bucketCounts = new Map<number, number>();
  let totalEvents = 0;
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;

  for (const [userId, events] of usersEvents) {
    if (events.length === 0) continue;
    userCounts.set(userId, events.length);
    totalEvents += events.length;
    minMs = Math.min(minMs, events[0]!.timestampMs);
    maxMs = Math.max(maxMs, events[events.length - 1]!.timestampMs);

    for (const event of events) {
      actionCounts.set(event.action, (actionCounts.get(event.action) ?? 0) + 1);
      const start = bucketStartMs(event.timestampMs, bucket);
      bucketCounts.set(start, (bucketCounts.get(start) ?? 0) + 1);
    }
  }

  if (totalEvents === 0) {
    return {
      total_events: 0,
      total_users: 0,
      distinct_actions: 0,
      range_start: null,
      range_end: null,
      bucket,
      activity: [],
      top_actions: [],
      top_users: [],
    };
  }

  // Walk every bucket from first to last, emitting zeros for the silent ones. A
  // series that skipped them would redraw the shape of the data: a user who went
  // quiet for a month would look identical to one who never stopped.
  const activity: ActivityBucket[] = [];
  for (let start = bucketStartMs(minMs, bucket); start <= maxMs; start = nextBucketMs(start, bucket)) {
    activity.push({ bucket_start: msToIso(start), count: bucketCounts.get(start) ?? 0 });
  }

  // Descending by count, ties broken by first-seen order — Array.sort is stable
  // (guaranteed since ES2019) and both Maps were built in the store's
  // user-iteration order, so equal counts keep the order they appeared in the CSV.
  const top_actions: ActionCount[] = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, OVERVIEW_TOP_N);

  const top_users: UserCount[] = Array.from(userCounts.entries())
    .map(([user_id, count]) => ({ user_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, OVERVIEW_TOP_N);

  return {
    total_events: totalEvents,
    total_users: userCounts.size,
    distinct_actions: actionCounts.size,
    range_start: msToIso(minMs),
    range_end: msToIso(maxMs),
    bucket,
    activity,
    top_actions,
    top_users,
  };
}
