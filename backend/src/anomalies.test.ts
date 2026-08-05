import { describe, it, expect } from 'vitest';
import { computeAnomalies } from './anomalies';
import type { ActivityEvent } from './types';

function event(action: string, duration: number, timestamp: string): ActivityEvent {
  return {
    userId: 1,
    timestamp,
    timestampMs: Date.parse(timestamp),
    action,
    metadata: { page: 'home', duration },
  };
}

describe('computeAnomalies', () => {
  it('flags no anomalies when all durations for an action are identical', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      event('click', 20, `2024-01-01T00:0${i}:00Z`),
    );
    expect(computeAnomalies(events)).toEqual([]);
  });

  it('flags no anomalies for a single-sample group (population stddev is 0)', () => {
    const events = [event('click', 999, '2024-01-01T00:00:00Z')];
    expect(computeAnomalies(events)).toEqual([]);
  });

  it('flags a clear outlier once enough samples keep the mean/stddev from being swamped by it', () => {
    const low = Array.from({ length: 9 }, (_, i) =>
      event('click', 10, `2024-01-01T00:0${i}:00Z`),
    );
    const outlier = event('click', 200, '2024-01-01T00:09:00Z');
    const anomalies = computeAnomalies([...low, outlier]);
    expect(anomalies).toEqual([{ timestamp: '2024-01-01T00:09:00Z', action: 'click', duration: 200 }]);
  });

  it('groups strictly per action, so an outlier in one action does not affect another', () => {
    const clickLow = Array.from({ length: 9 }, (_, i) =>
      event('click', 10, `2024-01-01T00:0${i}:00Z`),
    );
    const clickOutlier = event('click', 200, '2024-01-01T00:09:00Z');
    const viewSteady = [
      event('view', 50, '2024-01-01T01:00:00Z'),
      event('view', 52, '2024-01-01T01:01:00Z'),
      event('view', 48, '2024-01-01T01:02:00Z'),
    ];
    const anomalies = computeAnomalies([...clickLow, clickOutlier, ...viewSteady]);
    expect(anomalies).toEqual([{ timestamp: '2024-01-01T00:09:00Z', action: 'click', duration: 200 }]);
  });
});
