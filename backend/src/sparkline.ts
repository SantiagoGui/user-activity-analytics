import type { ActivityEvent } from './types';

/**
 * A fixed-length activity series for one user, for the user list's sparkline.
 *
 * Deliberately *not* the same machinery as /overview's activity buckets: those
 * are calendar-aligned so the x-axis is readable, while this is a fixed number
 * of equal slices of the dataset span so every user's shape is directly
 * comparable at ~90px wide regardless of how long they were active.
 *
 * Counts are raw, not normalised — the frontend scales each series to its own
 * maximum, so a quiet user still shows a legible shape.
 */
export function computeSparkline(
  events: ActivityEvent[],
  startMs: number,
  endMs: number,
  buckets: number,
): number[] {
  const series = new Array<number>(buckets).fill(0);
  const span = endMs - startMs;

  for (const event of events) {
    const position = span === 0 ? 0 : ((event.timestampMs - startMs) / span) * buckets;
    // An event exactly at endMs lands on `buckets`, one past the last index.
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(position)));
    series[index]! += 1;
  }

  return series;
}
