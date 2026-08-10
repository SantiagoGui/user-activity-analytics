import { describe, it, expect } from 'vitest';
import { ActivityStore } from './store';
import type { ActivityEvent, LoadResult } from './types';

function event(userId: number, timestamp: string): ActivityEvent {
  return {
    userId,
    timestamp,
    timestampMs: Date.parse(timestamp),
    action: 'click',
    metadata: { page: 'home', duration: 1 },
  };
}

const emptyResult: LoadResult = { totalLines: 0, loaded: 0, skipped: 0, skippedReasons: [] };

describe('ActivityStore', () => {
  it('includes events exactly at startMs and exactly at endMs (inclusive range)', () => {
    const store = new ActivityStore();
    const events = [
      event(1, '2024-01-01T10:00:00Z'),
      event(1, '2024-01-01T11:00:00Z'),
      event(1, '2024-01-01T12:00:00Z'),
    ];
    store.replaceData(events, emptyResult);

    const startMs = Date.parse('2024-01-01T10:00:00Z');
    const endMs = Date.parse('2024-01-01T12:00:00Z');
    const inRange = store.getUserEventsInRange(1, startMs, endMs)!;
    expect(inRange.map((e) => e.timestamp)).toEqual([
      '2024-01-01T10:00:00Z',
      '2024-01-01T11:00:00Z',
      '2024-01-01T12:00:00Z',
    ]);
  });

  it('excludes events just outside either boundary', () => {
    const store = new ActivityStore();
    const events = [
      event(1, '2024-01-01T09:59:59Z'),
      event(1, '2024-01-01T10:00:00Z'),
      event(1, '2024-01-01T12:00:00Z'),
      event(1, '2024-01-01T12:00:01Z'),
    ];
    store.replaceData(events, emptyResult);

    const startMs = Date.parse('2024-01-01T10:00:00Z');
    const endMs = Date.parse('2024-01-01T12:00:00Z');
    const inRange = store.getUserEventsInRange(1, startMs, endMs)!;
    expect(inRange.map((e) => e.timestamp)).toEqual(['2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z']);
  });

  it('sorts events ascending by timestamp regardless of insertion order', () => {
    const store = new ActivityStore();
    store.replaceData(
      [event(1, '2024-01-01T12:00:00Z'), event(1, '2024-01-01T10:00:00Z'), event(1, '2024-01-01T11:00:00Z')],
      emptyResult,
    );
    const all = store.getUserEventsInRange(1)!;
    expect(all.map((e) => e.timestamp)).toEqual([
      '2024-01-01T10:00:00Z',
      '2024-01-01T11:00:00Z',
      '2024-01-01T12:00:00Z',
    ]);
  });

  it('omits users with zero events in range from getAllUsersEventsInRange', () => {
    const store = new ActivityStore();
    store.replaceData([event(1, '2024-01-01T09:00:00Z'), event(2, '2024-06-01T09:00:00Z')], emptyResult);

    const startMs = Date.parse('2024-01-01T00:00:00Z');
    const endMs = Date.parse('2024-01-31T00:00:00Z');
    const inRange = store.getAllUsersEventsInRange(startMs, endMs);
    expect(Array.from(inRange.keys())).toEqual([1]);
  });

  it('returns undefined for a user with no data at all, distinct from an empty range', () => {
    const store = new ActivityStore();
    store.replaceData([event(1, '2024-01-01T09:00:00Z')], emptyResult);
    expect(store.getUserEventsInRange(999)).toBeUndefined();
    expect(store.hasUser(999)).toBe(false);
  });
});

describe('getDatasetBounds', () => {
  it('returns null before any load', () => {
    expect(new ActivityStore().getDatasetBounds()).toBeNull();
  });

  it('spans the earliest and latest event across all users', () => {
    const store = new ActivityStore();
    store.replaceData(
      [
        event(2, '2024-06-01T00:00:00Z'),
        event(1, '2024-01-01T00:00:00Z'),
        event(1, '2024-12-31T00:00:00Z'),
      ],
      { totalLines: 3, loaded: 3, skipped: 0, skippedReasons: [] },
    );
    expect(store.getDatasetBounds()).toEqual({
      startMs: Date.parse('2024-01-01T00:00:00Z'),
      endMs: Date.parse('2024-12-31T00:00:00Z'),
    });
  });
});

describe('listUserCounts', () => {
  it('gives every user a fixed-length series summing to their count', () => {
    const store = new ActivityStore();
    store.replaceData(
      [
        event(1, '2024-01-01T00:00:00Z'),
        event(1, '2024-06-01T00:00:00Z'),
        event(2, '2024-12-31T00:00:00Z'),
      ],
      { totalLines: 3, loaded: 3, skipped: 0, skippedReasons: [] },
    );
    const users = store.listUserCounts();
    expect(users).toHaveLength(2);
    for (const user of users) {
      expect(user.activity).toHaveLength(24);
      expect(user.activity.reduce((a, b) => a + b, 0)).toBe(user.count);
    }
  });
});
