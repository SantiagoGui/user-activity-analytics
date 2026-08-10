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

  // Phase 3 change: /sessions now returns the paginated envelope
  // { items, page, page_size, total, total_pages } instead of a bare array
  // (docs/roadmap.md Phase 3). The session list itself is unchanged.
  // Phase 7b adds range_start/range_end — the first session's start and the
  // last session's end across the *full* (pre-pagination) list, so the
  // frontend timeline's axis stays fixed as you paginate.
  it('/sessions 200s with the paginated session envelope for a known user', async () => {
    const res = await request(app).get('/sessions?user_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        { start: '2024-01-01T09:00:00Z', end: '2024-01-01T09:10:00Z', actions: 3, total_duration: 90 },
        { start: '2024-01-01T10:00:00Z', end: '2024-01-01T10:00:00Z', actions: 1, total_duration: 10 },
      ],
      page: 1,
      page_size: 20,
      total: 2,
      total_pages: 1,
      range_start: '2024-01-01T09:00:00Z',
      range_end: '2024-01-01T10:00:00Z',
    });
  });

  // Phase 3 change: same envelope as /sessions above. total_pages is 0, not 1,
  // for an empty result — Math.ceil(0/20) = 0, i.e. zero pages, not one empty page.
  it('/anomalies 200s with an empty paginated envelope when nothing clears the threshold', async () => {
    const res = await request(app).get('/anomalies?user_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, page_size: 20, total: 0, total_pages: 0 });
  });

  it('404s for an unknown user on both endpoints', async () => {
    const sessions = await request(app).get('/sessions?user_id=9999');
    const anomalies = await request(app).get('/anomalies?user_id=9999');
    expect(sessions.status).toBe(404);
    expect(anomalies.status).toBe(404);
  });

  // The 404-vs-200 asymmetry with /summary is untouched by Phase 3 — only the
  // shape of the 200 body changed, to the same envelope as the tests above.
  it('200s with an empty envelope (not 404) for a known user outside the time window', async () => {
    const res = await request(app).get(
      '/sessions?user_id=1&start_time=2030-01-01T00:00:00Z&end_time=2030-01-02T00:00:00Z',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
      range_start: null,
      range_end: null,
    });
  });

  // New in Phase 3: page/page_size are honored, and an out-of-range page
  // returns an empty items array with correct total/total_pages metadata
  // rather than a 400 — Phase 6 builds pagination UI on top of this shape.
  it('/sessions honors page/page_size and handles an out-of-range page', async () => {
    const firstPage = await request(app).get('/sessions?user_id=1&page=1&page_size=1');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({
      page: 1,
      page_size: 1,
      total: 2,
      total_pages: 2,
      range_start: '2024-01-01T09:00:00Z',
      range_end: '2024-01-01T10:00:00Z',
    });
    expect(firstPage.body.items).toHaveLength(1);

    // range_start/range_end stay fixed across pages — derived from the full
    // session list, not the page slice.
    const outOfRange = await request(app).get('/sessions?user_id=1&page=99&page_size=1');
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body).toEqual({
      items: [],
      page: 99,
      page_size: 1,
      total: 2,
      total_pages: 2,
      range_start: '2024-01-01T09:00:00Z',
      range_end: '2024-01-01T10:00:00Z',
    });
  });

  it('400s on an invalid page or page_size', async () => {
    const badPage = await request(app).get('/sessions?user_id=1&page=0');
    const badPageSize = await request(app).get('/sessions?user_id=1&page_size=abc');
    expect(badPage.status).toBe(400);
    expect(badPageSize.status).toBe(400);
  });
});

describe('GET /overview', () => {
  const app = createLoadedApp();

  it('503s before any successful load', async () => {
    const res = await request(createApp(new ActivityStore())).get('/overview');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not been loaded/i);
  });

  it('returns dataset totals with a weekly series by default', async () => {
    const res = await request(app).get('/overview');
    expect(res.status).toBe(200);
    expect(res.body.bucket).toBe('week');
    expect(res.body.total_events).toBeGreaterThan(0);
    expect(res.body.activity.length).toBeGreaterThan(0);
    expect(res.body.top_actions.length).toBeLessThanOrEqual(5);
  });

  it('honours an explicit bucket', async () => {
    const res = await request(app).get('/overview?bucket=month');
    expect(res.status).toBe(200);
    expect(res.body.bucket).toBe('month');
  });

  it('400s on an unrecognised bucket', async () => {
    const res = await request(app).get('/overview?bucket=fortnight');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('fortnight');
  });

  it('400s when start_time is after end_time', async () => {
    const res = await request(app).get('/overview?start_time=2024-06-01T00:00:00Z&end_time=2024-01-01T00:00:00Z');
    expect(res.status).toBe(400);
  });

  it('200s with zeros on an empty range rather than 404ing', async () => {
    // Unlike /summary, this endpoint describes a dataset — "nothing happened in
    // that window" is a correct answer, not a missing resource.
    const res = await request(app).get('/overview?start_time=1999-01-01T00:00:00Z&end_time=1999-01-02T00:00:00Z');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_events: 0,
      total_users: 0,
      range_start: null,
      range_end: null,
      activity: [],
    });
  });
});

describe('GET /action_trends', () => {
  const app = createLoadedApp();

  // No change from Phase 2: this test doesn't pass ?limit=, so the default
  // (still 3) is exercised, and the response is still a bare array — only
  // /sessions and /anomalies got the envelope treatment in Phase 3.
  it('200s with the top 3 (user_id, action) pairs by default', async () => {
    const res = await request(app).get('/action_trends');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { user_id: 1, action: 'click', count: 2 },
      { user_id: 2, action: 'search', count: 2 },
      { user_id: 3, action: 'download', count: 2 },
    ]);
  });

  // New in Phase 3: ?limit= overrides the default of 3.
  it('honors ?limit=', async () => {
    const res = await request(app).get('/action_trends?limit=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ user_id: 1, action: 'click', count: 2 }]);
  });

  it('400s on an invalid limit', async () => {
    const res = await request(app).get('/action_trends?limit=0');
    expect(res.status).toBe(400);
  });
});

describe('GET /users', () => {
  const app = createLoadedApp();

  it('200s with every user_id and its event count, sorted ascending', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.map((u: { user_id: number; count: number }) => ({ user_id: u.user_id, count: u.count }))).toEqual([
      { user_id: 1, count: 4 },
      { user_id: 2, count: 3 },
      { user_id: 3, count: 3 },
    ]);
  });
});

describe('GET /users sparklines', () => {
  it('carries a fixed-length activity series per user', async () => {
    const app = createLoadedApp();
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body[0].activity).toHaveLength(24);
  });
});

describe('GET /health', () => {
  it('200s with load status and row diagnostics once loaded', async () => {
    const app = createLoadedApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      loaded: true,
      total_lines: 10,
      rows_loaded: 10,
      rows_skipped: 0,
      skipped_reasons: [],
    });
    expect(res.body.dataset_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.dataset_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Deliberately exempt from requireLoaded (unlike every other endpoint below):
  // reporting "never loaded" is /health's actual job, not an error state.
  it('200s with loaded:false before any successful load, instead of 503ing', async () => {
    const app = createApp(new ActivityStore());
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      loaded: false,
      total_lines: null,
      rows_loaded: null,
      rows_skipped: null,
      skipped_reasons: null,
      dataset_start: null,
      dataset_end: null,
    });
  });
});

describe('GET /health dataset bounds', () => {
  it('reports nulls before a load', async () => {
    const res = await request(createApp(new ActivityStore())).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.dataset_start).toBeNull();
    expect(res.body.dataset_end).toBeNull();
  });

  it('reports the dataset span once loaded', async () => {
    const app = createLoadedApp();
    const res = await request(app).get('/health');
    expect(res.body.dataset_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.dataset_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('endpoints before any successful load', () => {
  it('503s on a freshly-constructed store', async () => {
    const app = createApp(new ActivityStore());
    const res = await request(app).get('/summary?user_id=1');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/has not been loaded yet/);
  });

  // New in Phase 3: /sessions, /anomalies, /users all go through the same
  // requireLoaded check as the Phase-1/2 endpoints.
  it('503s on /sessions, /anomalies, /users, and /overview', async () => {
    const app = createApp(new ActivityStore());
    const sessions = await request(app).get('/sessions?user_id=1');
    const anomalies = await request(app).get('/anomalies?user_id=1');
    const users = await request(app).get('/users');
    const overview = await request(app).get('/overview');
    expect(sessions.status).toBe(503);
    expect(anomalies.status).toBe(503);
    expect(users.status).toBe(503);
    expect(overview.status).toBe(503);
  });
});
