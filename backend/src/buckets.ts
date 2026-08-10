import type { BucketSize } from 'activity-analytics-shared-types';

const DAY_MS = 86_400_000;

/** Start of the bucket containing `ms`, in UTC. */
export function bucketStartMs(ms: number, bucket: BucketSize): number {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  if (bucket === 'month') return Date.UTC(year, month, 1);

  const dayStart = Date.UTC(year, month, d.getUTCDate());
  if (bucket === 'day') return dayStart;

  // getUTCDay() is 0 for Sunday; (day + 6) % 7 remaps so Monday is 0, which is
  // what makes a Sunday fall back to the Monday that started its week rather
  // than jumping forward six days.
  return dayStart - ((d.getUTCDay() + 6) % 7) * DAY_MS;
}

/** Start of the bucket immediately after the one beginning at `ms`. */
export function nextBucketMs(ms: number, bucket: BucketSize): number {
  if (bucket === 'month') {
    const d = new Date(ms);
    // Calendar increment, not a fixed delta — month lengths vary. UTC throughout,
    // so there is no DST discontinuity to account for.
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return ms + (bucket === 'day' ? DAY_MS : 7 * DAY_MS);
}
