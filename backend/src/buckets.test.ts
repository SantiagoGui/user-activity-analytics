import { describe, it, expect } from 'vitest';
import { bucketStartMs, nextBucketMs } from './buckets';

const ms = (iso: string) => Date.parse(iso);

describe('bucketStartMs', () => {
  it('floors a day to UTC midnight', () => {
    expect(bucketStartMs(ms('2024-03-14T23:59:59Z'), 'day')).toBe(ms('2024-03-14T00:00:00Z'));
  });

  it('floors a week to the preceding UTC Monday', () => {
    // 2024-03-14 is a Thursday.
    expect(bucketStartMs(ms('2024-03-14T12:00:00Z'), 'week')).toBe(ms('2024-03-11T00:00:00Z'));
  });

  it('treats Monday as its own week start', () => {
    expect(bucketStartMs(ms('2024-03-11T00:00:00Z'), 'week')).toBe(ms('2024-03-11T00:00:00Z'));
  });

  it('puts Sunday in the week that began the previous Monday', () => {
    // getUTCDay() is 0 for Sunday, so a naive floor would jump forward six days.
    expect(bucketStartMs(ms('2024-03-17T23:00:00Z'), 'week')).toBe(ms('2024-03-11T00:00:00Z'));
  });

  it('floors a month to the 1st at UTC midnight', () => {
    expect(bucketStartMs(ms('2024-03-31T18:00:00Z'), 'month')).toBe(ms('2024-03-01T00:00:00Z'));
  });
});

describe('nextBucketMs', () => {
  it('steps a day', () => {
    expect(nextBucketMs(ms('2024-03-14T00:00:00Z'), 'day')).toBe(ms('2024-03-15T00:00:00Z'));
  });

  it('steps a week', () => {
    expect(nextBucketMs(ms('2024-03-11T00:00:00Z'), 'week')).toBe(ms('2024-03-18T00:00:00Z'));
  });

  it('steps a month by calendar, not by a fixed delta', () => {
    expect(nextBucketMs(ms('2024-01-01T00:00:00Z'), 'month')).toBe(ms('2024-02-01T00:00:00Z'));
    expect(nextBucketMs(ms('2024-02-01T00:00:00Z'), 'month')).toBe(ms('2024-03-01T00:00:00Z'));
  });

  it('steps a month across a year boundary', () => {
    expect(nextBucketMs(ms('2024-12-01T00:00:00Z'), 'month')).toBe(ms('2025-01-01T00:00:00Z'));
  });
});
