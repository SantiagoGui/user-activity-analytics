import { describe, it, expect } from 'vitest';
import { parseActivitiesCsv } from './csvParser';

const HEADER = 'user_id,timestamp,action,metadata';

describe('parseActivitiesCsv', () => {
  it('parses the unquoted-JSON-with-commas line from docs/data-source.md', () => {
    const csv = `${HEADER}\n72,2024-01-04T05:20:04Z,logout,{"page": "dashboard", "duration": 107}`;
    const { events, result } = parseActivitiesCsv(csv);
    expect(result.loaded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(events).toEqual([
      {
        userId: 72,
        timestamp: '2024-01-04T05:20:04Z',
        timestampMs: Date.parse('2024-01-04T05:20:04Z'),
        action: 'logout',
        metadata: { page: 'dashboard', duration: 107 },
      },
    ]);
  });

  it('throws on a structurally wrong header', () => {
    const csv = 'id,time,type,meta\n1,2024-01-01T00:00:00Z,login,{"page":"home","duration":1}';
    expect(() => parseActivitiesCsv(csv)).toThrow(/Unexpected CSV header/);
  });

  it('throws on a truly empty file', () => {
    expect(() => parseActivitiesCsv('')).toThrow(/CSV is empty/);
  });

  it('loads zero events for a header-only body without throwing', () => {
    const { events, result } = parseActivitiesCsv(HEADER);
    expect(events).toEqual([]);
    expect(result).toEqual({ totalLines: 0, loaded: 0, skipped: 0, skippedReasons: [] });
  });

  it('skips and counts a row with an invalid user_id, keeping good rows', () => {
    const csv = [
      HEADER,
      'notanumber,2024-01-01T00:00:00Z,login,{"page":"home","duration":1}',
      '1,2024-01-01T00:00:01Z,login,{"page":"home","duration":2}',
    ].join('\n');
    const { events, result } = parseActivitiesCsv(csv);
    expect(events).toHaveLength(1);
    expect(result.loaded).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedReasons[0]).toMatch(/invalid user_id/);
  });

  it('skips and counts a row with an invalid timestamp', () => {
    const csv = [HEADER, '1,not-a-date,login,{"page":"home","duration":1}'].join('\n');
    const { events, result } = parseActivitiesCsv(csv);
    expect(events).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.skippedReasons[0]).toMatch(/invalid timestamp/);
  });

  it('skips and counts a row with malformed metadata JSON', () => {
    const csv = [HEADER, '1,2024-01-01T00:00:00Z,login,{not valid json}'].join('\n');
    const { events, result } = parseActivitiesCsv(csv);
    expect(events).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.skippedReasons[0]).toMatch(/invalid metadata JSON/);
  });

  it('rejects a negative duration as an invalid row', () => {
    const csv = [HEADER, '1,2024-01-01T00:00:00Z,login,{"page":"home","duration":-5}'].join('\n');
    const { events, result } = parseActivitiesCsv(csv);
    expect(events).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.skippedReasons[0]).toMatch(/invalid metadata JSON/);
  });
});
