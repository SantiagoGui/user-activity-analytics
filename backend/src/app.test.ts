import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { ActivityStore } from './store';
import { parseActivitiesCsv } from './csvParser';

/**
 * Builds a loaded store straight from the fixture CSV, bypassing
 * loadActivities/fetchActivitiesCsv entirely so these tests never touch the
 * network (see docs/roadmap.md Phase 2: "tests must not hit the CDN").
 */
function createLoadedApp() {
  const csv = readFileSync(join(__dirname, '..', 'test', 'fixtures', 'activities.csv'), 'utf-8');
  const { events, result } = parseActivitiesCsv(csv);
  const store = new ActivityStore();
  store.replaceData(events, result);
  return createApp(store);
}

describe('GET /summary', () => {
  const app = createLoadedApp();

  it('200s with computed stats for a known user', async () => {
    const res = await request(app).get('/summary?user_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 1,
      total_actions: 4,
      most_frequent_action: 'click',
      avg_duration: 25,
      most_frequent_page: 'dashboard',
    });
  });

  it('404s for a user_id with no data at all', async () => {
    const res = await request(app).get('/summary?user_id=9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No data for user 9999/);
  });

  it('404s with an "in the given time range" message for a known user outside the window', async () => {
    const res = await request(app).get(
      '/summary?user_id=1&start_time=2030-01-01T00:00:00Z&end_time=2030-01-02T00:00:00Z',
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/in the given time range/);
  });

  it('400s on an invalid start_time', async () => {
    const res = await request(app).get('/summary?user_id=1&start_time=not-a-date');
    expect(res.status).toBe(400);
  });

  it('400s when start_time is after end_time', async () => {
    const res = await request(app).get(
      '/summary?user_id=1&start_time=2024-06-01T00:00:00Z&end_time=2024-01-01T00:00:00Z',
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /sessions and /anomalies', () => {
  const app = createLoadedApp();

  it('/sessions 200s with the computed session list for a known user', async () => {
    const res = await request(app).get('/sessions?user_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { start: '2024-01-01T09:00:00Z', end: '2024-01-01T09:10:00Z', actions: 3, total_duration: 90 },
      { start: '2024-01-01T10:00:00Z', end: '2024-01-01T10:00:00Z', actions: 1, total_duration: 10 },
    ]);
  });

  it('/anomalies 200s with an empty list when nothing clears the threshold', async () => {
    const res = await request(app).get('/anomalies?user_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('404s for an unknown user on both endpoints', async () => {
    const sessions = await request(app).get('/sessions?user_id=9999');
    const anomalies = await request(app).get('/anomalies?user_id=9999');
    expect(sessions.status).toBe(404);
    expect(anomalies.status).toBe(404);
  });

  it('200s with [] (not 404) for a known user outside the time window', async () => {
    const res = await request(app).get(
      '/sessions?user_id=1&start_time=2030-01-01T00:00:00Z&end_time=2030-01-02T00:00:00Z',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /action_trends', () => {
  const app = createLoadedApp();

  it('200s with the top 3 (user_id, action) pairs', async () => {
    const res = await request(app).get('/action_trends');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { user_id: 1, action: 'click', count: 2 },
      { user_id: 2, action: 'search', count: 2 },
      { user_id: 3, action: 'download', count: 2 },
    ]);
  });
});

describe('endpoints before any successful load', () => {
  it('503s on a freshly-constructed store', async () => {
    const app = createApp(new ActivityStore());
    const res = await request(app).get('/summary?user_id=1');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/has not been loaded yet/);
  });
});
