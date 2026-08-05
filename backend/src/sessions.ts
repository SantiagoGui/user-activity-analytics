import type { ActivityEvent, SessionSummary } from './types';

const SESSION_GAP_MS = 30 * 60 * 1000;

/**
 * Groups a single user's events (already sorted ascending by timestamp — see
 * store.ts) into sessions: a new session starts whenever the gap since the
 * previous action exceeds 30 minutes. The gap check is inclusive (<=), matching
 * the spec's worked example: 12:00 login + 12:25 click (25 min gap) is one
 * session; a 13:00 action after that (35 min gap) starts a new one.
 */
export function computeSessions(events: ActivityEvent[]): SessionSummary[] {
  if (events.length === 0) return [];

  const sessions: SessionSummary[] = [];
  let sessionStart = events[0]!;
  let sessionEnd = events[0]!;
  let actionCount = 1;
  let totalDuration = events[0]!.metadata.duration;

  for (let i = 1; i < events.length; i++) {
    const event = events[i]!;
    const gapMs = event.timestampMs - sessionEnd.timestampMs;

    if (gapMs <= SESSION_GAP_MS) {
      sessionEnd = event;
      actionCount++;
      totalDuration += event.metadata.duration;
    } else {
      sessions.push({
        start: sessionStart.timestamp,
        end: sessionEnd.timestamp,
        actions: actionCount,
        total_duration: totalDuration,
      });
      sessionStart = event;
      sessionEnd = event;
      actionCount = 1;
      totalDuration = event.metadata.duration;
    }
  }

  sessions.push({
    start: sessionStart.timestamp,
    end: sessionEnd.timestamp,
    actions: actionCount,
    total_duration: totalDuration,
  });

  return sessions;
}
