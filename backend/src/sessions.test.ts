import { describe, it, expect } from 'vitest';
import { computeSessions } from './sessions';
import type { ActivityEvent } from './types';

function event(timestamp: string, duration: number, action = 'click'): ActivityEvent {
  return {
    userId: 1,
    timestamp,
    timestampMs: Date.parse(timestamp),
    action,
    metadata: { page: 'home', duration },
  };
}

describe('computeSessions', () => {
  it('matches the spec worked example: 12:00 login + 12:25 click is one session, 13:00 starts a new one', () => {
    const events = [
      event('2024-01-01T12:00:00Z', 10, 'login'),
      event('2024-01-01T12:25:00Z', 20, 'click'),
      event('2024-01-01T13:00:00Z', 30, 'view'),
    ];
    expect(computeSessions(events)).toEqual([
      { start: '2024-01-01T12:00:00Z', end: '2024-01-01T12:25:00Z', actions: 2, total_duration: 30 },
      { start: '2024-01-01T13:00:00Z', end: '2024-01-01T13:00:00Z', actions: 1, total_duration: 30 },
    ]);
  });

  it('keeps a gap of exactly 30 minutes in the same session (inclusive boundary)', () => {
    const events = [event('2024-01-01T12:00:00Z', 1), event('2024-01-01T12:30:00Z', 2)];
    const sessions = computeSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ actions: 2 });
  });

  it('splits a gap of 30 minutes + 1 second into a new session', () => {
    const events = [event('2024-01-01T12:00:00Z', 1), event('2024-01-01T12:30:01Z', 2)];
    expect(computeSessions(events)).toHaveLength(2);
  });

  it('returns one session for a single event', () => {
    const events = [event('2024-01-01T12:00:00Z', 5)];
    expect(computeSessions(events)).toEqual([
      { start: '2024-01-01T12:00:00Z', end: '2024-01-01T12:00:00Z', actions: 1, total_duration: 5 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(computeSessions([])).toEqual([]);
  });
});
