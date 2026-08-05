import type { ActivityEvent, AnomalyEvent } from './types';

const STD_DEV_THRESHOLD = 2;

/**
 * Flags events whose metadata.duration is more than 2 standard deviations from the
 * mean duration for that (user_id, action) pair — here `events` is already scoped
 * to a single user, so grouping is by `action` alone.
 *
 * Uses population standard deviation (divide by n, not n-1): this is a description
 * of the given sample's own spread, not an estimate from a larger population, and it
 * naturally handles small groups without a branch — a 0- or 1-sample group has
 * stdDev 0, so nothing in it can exceed a >0 deviation threshold, and a 2+ sample
 * group where every duration is identical also correctly yields zero anomalies.
 *
 * Note: the spec's own worked example ([30, 20, 25, 100] -> flag 100) does not
 * actually clear a strict >2*stddev bar computed over all 4 points (deviation of
 * the 100 sample is ~56, while 2*stddev is ~65 with population stddev, ~75 with
 * sample stddev) — the outlier inflates its own mean/stddev, which is expected
 * behavior for this method on n=4. Implemented per the literal spec formula rather
 * than tuned to match that example's numbers.
 */
export function computeAnomalies(events: ActivityEvent[]): AnomalyEvent[] {
  const byAction = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    let bucket = byAction.get(event.action);
    if (!bucket) {
      bucket = [];
      byAction.set(event.action, bucket);
    }
    bucket.push(event);
  }

  const anomalies: AnomalyEvent[] = [];
  for (const bucket of byAction.values()) {
    const mean = bucket.reduce((sum, e) => sum + e.metadata.duration, 0) / bucket.length;
    const variance = bucket.reduce((sum, e) => sum + (e.metadata.duration - mean) ** 2, 0) / bucket.length;
    const stdDev = Math.sqrt(variance);

    for (const event of bucket) {
      if (Math.abs(event.metadata.duration - mean) > STD_DEV_THRESHOLD * stdDev) {
        anomalies.push({ timestamp: event.timestamp, action: event.action, duration: event.metadata.duration });
      }
    }
  }

  anomalies.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return anomalies;
}
