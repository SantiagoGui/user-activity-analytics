import { describe, it, expect } from 'vitest';
import { computeOverview } from './overview';
import type { ActivityEvent } from './types';

function event(userId: number, iso: string, action: string, page = 'home', duration = 10): ActivityEvent {
  return {
    userId,
    timestamp: iso,
    timestampMs: Date.parse(iso),
    action,
    metadata: { page, duration },
  };
}

/** Mirrors the store's contract: one entry per user, events sorted ascending. */
function usersEvents(...groups: ActivityEvent[][]): Map<number, ActivityEvent[]> {
  const map = new Map<number, ActivityEvent[]>();
  for (const group of groups) map.set(group[0]!.userId, group);
  return map;
}

describe('computeOverview', () => {
  it('returns a well-formed empty result for no events', () => {
    const result = computeOverview(new Map(), 'week');
    expect(result).toEqual({
      total_events: 0,
      total_users: 0,
      distinct_actions: 0,
      range_start: null,
      range_end: null,
      bucket: 'week',
      activity: [],
      top_actions: [],
      top_users: [],
    });
  });

  it('totals events, users and distinct actions', () => {
    const result = computeOverview(
      usersEvents(
        [event(1, '2024-01-08T10:00:00Z', 'login'), event(1, '2024-01-09T10:00:00Z', 'click')],
        [event(2, '2024-01-10T10:00:00Z', 'login')],
      ),
      'week',
    );
    expect(result.total_events).toBe(3);
    expect(result.total_users).toBe(2);
    expect(result.distinct_actions).toBe(2);
    expect(result.range_start).toBe('2024-01-08T10:00:00Z');
    expect(result.range_end).toBe('2024-01-10T10:00:00Z');
  });

  it('emits empty buckets rather than skipping them', () => {
    // Two events three weeks apart: the two silent weeks between them must appear
    // as zeros, or the series misrepresents the shape of the data.
    const result = computeOverview(
      usersEvents([event(1, '2024-01-08T10:00:00Z', 'login'), event(1, '2024-01-29T10:00:00Z', 'login')]),
      'week',
    );
    expect(result.activity).toEqual([
      { bucket_start: '2024-01-08T00:00:00Z', count: 1 },
      { bucket_start: '2024-01-15T00:00:00Z', count: 0 },
      { bucket_start: '2024-01-22T00:00:00Z', count: 0 },
      { bucket_start: '2024-01-29T00:00:00Z', count: 1 },
    ]);
  });

  it('buckets by month across a year boundary', () => {
    const result = computeOverview(
      usersEvents([event(1, '2024-11-15T10:00:00Z', 'login'), event(1, '2025-01-05T10:00:00Z', 'login')]),
      'month',
    );
    expect(result.activity.map((b) => b.bucket_start)).toEqual([
      '2024-11-01T00:00:00Z',
      '2024-12-01T00:00:00Z',
      '2025-01-01T00:00:00Z',
    ]);
  });

  it('produces a single bucket when every event falls inside one', () => {
    const result = computeOverview(
      usersEvents([event(1, '2024-01-08T01:00:00Z', 'login'), event(1, '2024-01-08T23:00:00Z', 'login')]),
      'day',
    );
    expect(result.activity).toEqual([{ bucket_start: '2024-01-08T00:00:00Z', count: 2 }]);
  });

  it('ranks top actions by count and breaks ties by first-seen order', () => {
    const result = computeOverview(
      usersEvents([
        event(1, '2024-01-08T10:00:00Z', 'view'),
        event(1, '2024-01-08T11:00:00Z', 'login'),
        event(1, '2024-01-08T12:00:00Z', 'login'),
        event(1, '2024-01-08T13:00:00Z', 'click'),
      ]),
      'week',
    );
    expect(result.top_actions).toEqual([
      { action: 'login', count: 2 },
      { action: 'view', count: 1 },
      { action: 'click', count: 1 },
    ]);
  });

  it('ranks top users by count and caps at OVERVIEW_TOP_N', () => {
    const groups = Array.from({ length: 7 }, (_, i) =>
      Array.from({ length: i + 1 }, (_, n) =>
        event(i + 1, `2024-01-0${(n % 8) + 1}T10:00:00Z`, 'login'),
      ).sort((a, b) => a.timestampMs - b.timestampMs),
    );
    const result = computeOverview(usersEvents(...groups), 'week');
    expect(result.top_users).toHaveLength(5);
    expect(result.top_users.map((u) => u.user_id)).toEqual([7, 6, 5, 4, 3]);
  });
});
