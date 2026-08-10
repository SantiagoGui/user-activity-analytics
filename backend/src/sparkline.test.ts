import { describe, it, expect } from 'vitest';
import { computeSparkline } from './sparkline';
import type { ActivityEvent } from './types';

const at = (iso: string): ActivityEvent => ({
  userId: 1,
  timestamp: iso,
  timestampMs: Date.parse(iso),
  action: 'login',
  metadata: { page: 'home', duration: 10 },
});

const START = Date.parse('2024-01-01T00:00:00Z');
const END = Date.parse('2024-01-05T00:00:00Z');

describe('computeSparkline', () => {
  it('returns a fixed-length series of zeros for no events', () => {
    const series = computeSparkline([], START, END, 4);
    expect(series).toEqual([0, 0, 0, 0]);
  });

  it('always returns exactly `buckets` entries', () => {
    const series = computeSparkline([at('2024-01-02T00:00:00Z')], START, END, 24);
    expect(series).toHaveLength(24);
  });

  it('sums to the event count', () => {
    const events = [at('2024-01-01T00:00:00Z'), at('2024-01-02T12:00:00Z'), at('2024-01-04T00:00:00Z')];
    const series = computeSparkline(events, START, END, 4);
    expect(series.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('distributes events across buckets proportionally', () => {
    const events = [at('2024-01-01T00:00:00Z'), at('2024-01-02T00:00:00Z'), at('2024-01-04T00:00:00Z')];
    expect(computeSparkline(events, START, END, 4)).toEqual([1, 1, 0, 1]);
  });

  it('puts an event exactly at the end bound in the last bucket', () => {
    // Without a clamp this indexes one past the end of the array.
    expect(computeSparkline([at('2024-01-05T00:00:00Z')], START, END, 4)).toEqual([0, 0, 0, 1]);
  });

  it('puts everything in the first bucket when the span is zero', () => {
    expect(computeSparkline([at('2024-01-01T00:00:00Z')], START, START, 4)).toEqual([1, 0, 0, 0]);
  });
});
