import { describe, it, expect } from 'vitest';
import { computeUserSummary, computeActionTrends } from './analytics';
import type { ActivityEvent } from './types';

function event(action: string, page: string, duration: number, timestamp: string): ActivityEvent {
  return {
    userId: 1,
    timestamp,
    timestampMs: Date.parse(timestamp),
    action,
    metadata: { page, duration },
  };
}

describe('computeUserSummary', () => {
  it('breaks a most_frequent_action tie by first-seen order, not alphabetical order', () => {
    // "zeta" is inserted first and ties with "alpha" at count 2. An alphabetical
    // tie-break would incorrectly pick "alpha"; first-seen-order picks "zeta".
    const events = [
      event('zeta', 'home', 1, '2024-01-01T00:00:00Z'),
      event('zeta', 'home', 1, '2024-01-01T00:01:00Z'),
      event('alpha', 'home', 1, '2024-01-01T00:02:00Z'),
      event('alpha', 'home', 1, '2024-01-01T00:03:00Z'),
    ];
    expect(computeUserSummary(1, events).most_frequent_action).toBe('zeta');
  });

  it('breaks a most_frequent_page tie by first-seen order, not alphabetical order', () => {
    const events = [
      event('click', 'zeta-page', 1, '2024-01-01T00:00:00Z'),
      event('click', 'zeta-page', 1, '2024-01-01T00:01:00Z'),
      event('click', 'alpha-page', 1, '2024-01-01T00:02:00Z'),
      event('click', 'alpha-page', 1, '2024-01-01T00:03:00Z'),
    ];
    expect(computeUserSummary(1, events).most_frequent_page).toBe('zeta-page');
  });

  it('computes total_actions and avg_duration', () => {
    const events = [
      event('click', 'home', 10, '2024-01-01T00:00:00Z'),
      event('click', 'home', 20, '2024-01-01T00:01:00Z'),
      event('view', 'home', 30, '2024-01-01T00:02:00Z'),
    ];
    const summary = computeUserSummary(1, events);
    expect(summary.total_actions).toBe(3);
    expect(summary.avg_duration).toBe(20);
  });
});

describe('computeActionTrends', () => {
  it('breaks a count tie by first-seen (user iteration) order, not by sorting keys', () => {
    // Map insertion order: userId 99 first, userId 1 second. Both pairs tie at
    // count 2. A numeric/alphabetical re-sort of the tied keys would put "1:aaa"
    // first; first-seen order keeps "99:zzz" first because it was seen first.
    const usersEvents = new Map<number, ActivityEvent[]>([
      [99, [event('zzz', 'home', 1, '2024-01-01T00:00:00Z'), event('zzz', 'home', 1, '2024-01-01T00:01:00Z')]],
      [1, [event('aaa', 'home', 1, '2024-01-01T00:02:00Z'), event('aaa', 'home', 1, '2024-01-01T00:03:00Z')]],
    ]);
    const top = computeActionTrends(usersEvents, 1);
    expect(top).toEqual([{ user_id: 99, action: 'zzz', count: 2 }]);
  });

  it('returns the top N pairs sorted by count descending', () => {
    const usersEvents = new Map<number, ActivityEvent[]>([
      [1, [event('a', 'home', 1, '2024-01-01T00:00:00Z')]],
      [
        2,
        [
          event('b', 'home', 1, '2024-01-01T00:01:00Z'),
          event('b', 'home', 1, '2024-01-01T00:02:00Z'),
          event('b', 'home', 1, '2024-01-01T00:03:00Z'),
        ],
      ],
    ]);
    const top = computeActionTrends(usersEvents, 2);
    expect(top).toEqual([
      { user_id: 2, action: 'b', count: 3 },
      { user_id: 1, action: 'a', count: 1 },
    ]);
  });
});
