# Phase 8 — Product Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a four-screen query tool into a three-screen product that opens with an answer, lets you pick a user from a list instead of guessing an integer, and looks like a precision instrument.

**Architecture:** One new read-only endpoint (`GET /overview`) that describes the dataset rather than a slice of it, built on the store's existing per-user sorted index — no new data structures and no change to the load path. On the frontend, `/summary`, `/sessions` and `/anomalies` collapse into a single master–detail `/users` screen, and a new Overview takes over `/`. Filters move from a full-height left rail into a shared top bar. Visual identity comes from a data monospace, a domain-derived wordmark, and hand-styled charts — not from a component library.

**Tech Stack:** Node 18+, TypeScript (strict), Express, Vitest, supertest, React 18, Vite 5, react-router-dom 7, Chart.js 4 + react-chartjs-2, Radix UI (tabs + popover only), `@fontsource/jetbrains-mono`.

**Design source of truth:** [`docs/superpowers/specs/2026-08-10-overview-product-design.md`](../specs/2026-08-10-overview-product-design.md). Read it before Task 1.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript strict on both packages.** No `any` on data flowing into a query; no `as` used to silence a type error.
- **Every task ends green:** `npx tsc --noEmit` clean in `backend/`, `npx tsc -b --noEmit` clean in `frontend/`, `npm test` passing in both.
- **All timestamps are UTC.** The API accepts and returns UTC ISO 8601. Never route a `datetime-local` value through `new Date()` — append `:00Z` (see `frontend/src/time.ts`).
- **Errors are JSON + correct status codes**, always `{ error: string }`. Route handlers throw `HttpError`; the central handler converts.
- **No new global state.** Dependencies constructed at the composition root and passed as parameters. No module-level singletons.
- **Comment the *why*, not the *what*.** A handful of high-value comments explaining decisions a reader would question. No step-narration inside functions.
- **Keep `frontend/vite.config.ts` in sync with every endpoint the frontend calls by relative path.** A missing proxy entry only surfaces as a 404 on a fresh clone.
- **Ties break by first-seen order** — `Map` insertion order plus `Array.prototype.sort` stability. Never incidental key iteration order.
- **Commit style:** single-line conventional titles (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:`), no body, **no `Co-Authored-By` trailer**.
- **Branch:** all work on `feature/santiagogui/phase-8-product-shape`, created before the first commit. Never commit to `main`. Never push unless explicitly asked.
- **Pinned choices** (do not re-decide):
  - Monospace: **JetBrains Mono**, via `@fontsource/jetbrains-mono` (npm, self-hosted, no CDN). Weights 400 and 500 only.
  - Radix packages: `@radix-ui/react-tabs` and `@radix-ui/react-popover`. **No other Radix packages, no Tailwind, no shadcn.**
  - Accent stays `#57449a`; surface stays `#e8f1f9`. No dark mode.
  - `OVERVIEW_TOP_N = 5`, `USER_SPARKLINE_BUCKETS = 24`, `DEFAULT_BUCKET = 'week'`.

## Prerequisites

```bash
cd backend && npm install
cd ../frontend && npm install
git checkout -b feature/santiagogui/phase-8-product-shape
```

`node_modules/` is absent on a fresh clone. `shared/` is a `file:` dependency of both packages — installing each package wires it up.

---

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `backend/src/buckets.ts` | UTC bucket-boundary math (`bucketStartMs`, `nextBucketMs`). Pure, no domain knowledge. |
| `backend/src/buckets.test.ts` | Boundary tests for day/week/month. |
| `backend/src/overview.ts` | `computeOverview()` — dataset-level aggregation over a range. |
| `backend/src/overview.test.ts` | |
| `backend/src/sparkline.ts` | `computeSparkline()` — fixed-length activity series for one user. |
| `backend/src/sparkline.test.ts` | |

**Backend — modified**

| File | Change |
|---|---|
| `backend/src/config.ts` | `DEFAULT_BUCKET`, `OVERVIEW_TOP_N`, `USER_SPARKLINE_BUCKETS` |
| `backend/src/validation.ts` | `parseBucket()` |
| `backend/src/store.ts` | dataset bounds in `replaceData`, `getDatasetBounds()`, `listUserCounts()` gains `activity` |
| `backend/src/app.ts` | `GET /overview`; `/health` gains bounds |
| `backend/src/shared/time.ts` | `msToIso()` |
| `shared/types.ts` | `BucketSize`, `ActivityBucket`, `ActionCount`, `Overview`, `Health`; `UserCount.activity` |

**Frontend — created**

| File | Responsibility |
|---|---|
| `frontend/src/components/Wordmark.tsx` | The session-bars mark. |
| `frontend/src/components/TopFilterBar.tsx` | Shared range chips + custom-range popover + bucket control. |
| `frontend/src/components/StatTile.tsx` | One label + one figure. Used by Overview and UserDetail. |
| `frontend/src/components/ActivityChart.tsx` | Chart.js line, restyled. |
| `frontend/src/components/Sparkline.tsx` | Inline SVG polyline, ~90px. |
| `frontend/src/components/Overview.tsx` | The `/` screen. |
| `frontend/src/components/UserList.tsx` | Search + scrollable list with sparklines. |
| `frontend/src/components/UserDetail.tsx` | Tile row + Radix tabs. |
| `frontend/src/components/SessionsPanel.tsx` | Timeline + table + pagination (lifted from `SessionsForm`). |
| `frontend/src/components/AnomaliesPanel.tsx` | Table + pagination (lifted from `AnomaliesForm`). |
| `frontend/src/components/UsersScreen.tsx` | Assembles list + detail. |
| `frontend/src/components/Skeleton.tsx` | Loading placeholder rows. |
| `frontend/src/hooks/useDatasetBounds.ts` | Reads `/health` once. |

**Frontend — deleted**

`UserSummaryForm.tsx`, `SessionsForm.tsx`, `AnomaliesForm.tsx`, `ActivityFilters.tsx` (its validation moves to `TopFilterBar`).

**Frontend — modified**

`App.tsx` (routes + redirects), `Layout.tsx` (nav + wordmark), `api.ts`, `types.ts`, `hooks/useUrlFilters.ts`, `hooks/useUsers.ts`, `components/ActionTrendsChart.tsx`, `index.css`, `vite.config.ts`, `main.tsx` (font import).

---

# Step 1 — Backend

Purely additive. Nothing the frontend currently calls changes shape except `/health` and `/users`, which gain fields.

## Task 1: Bucket boundary math

**Files:**
- Create: `backend/src/buckets.ts`
- Test: `backend/src/buckets.test.ts`
- Modify: `shared/types.ts`

**Interfaces:**
- Produces: `type BucketSize = 'day' | 'week' | 'month'` (in `shared/types.ts`); `bucketStartMs(ms: number, bucket: BucketSize): number`; `nextBucketMs(ms: number, bucket: BucketSize): number`.

- [ ] **Step 1: Add the type to `shared/types.ts`**

Append:

```ts
// Time-bucket granularity for GET /overview's activity series.
export type BucketSize = 'day' | 'week' | 'month';
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/buckets.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd backend && npx vitest run src/buckets.test.ts`
Expected: FAIL — cannot resolve `./buckets`.

- [ ] **Step 4: Implement `backend/src/buckets.ts`**

```ts
import type { BucketSize } from 'activity-analytics-shared-types';

const DAY_MS = 86_400_000;

/** Start of the bucket containing `ms`, in UTC. */
export function bucketStartMs(ms: number, bucket: BucketSize): number {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  if (bucket === 'month') return Date.UTC(year, month, 1);

  const dayStart = Date.UTC(year, month, d.getUTCDate());
  if (bucket === 'day') return dayStart;

  // getUTCDay() is 0 for Sunday; (day + 6) % 7 remaps so Monday is 0, which is
  // what makes a Sunday fall back to the Monday that started its week rather
  // than jumping forward six days.
  return dayStart - ((d.getUTCDay() + 6) % 7) * DAY_MS;
}

/** Start of the bucket immediately after the one beginning at `ms`. */
export function nextBucketMs(ms: number, bucket: BucketSize): number {
  if (bucket === 'month') {
    const d = new Date(ms);
    // Calendar increment, not a fixed delta — month lengths vary. UTC throughout,
    // so there is no DST discontinuity to account for.
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return ms + (bucket === 'day' ? DAY_MS : 7 * DAY_MS);
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `cd backend && npx vitest run src/buckets.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit
git add shared/types.ts backend/src/buckets.ts backend/src/buckets.test.ts
git commit -m "feat: add UTC time-bucket boundary helpers"
```

---

## Task 2: `parseBucket` and config constants

**Files:**
- Modify: `backend/src/config.ts`, `backend/src/validation.ts`
- Test: `backend/src/validation.test.ts` (create — validation currently has no test file of its own; its behaviour is covered indirectly by `app.test.ts`)

**Interfaces:**
- Consumes: `BucketSize` from Task 1.
- Produces: `parseBucket(query: Record<string, unknown>): BucketSize`.

- [ ] **Step 1: Add constants to `backend/src/config.ts`**

Append:

```ts
export const DEFAULT_BUCKET = 'week';

// How many top actions / top users GET /overview returns. Five fits the two
// summary cards without scrolling; the endpoint is a summary, not a browser.
export const OVERVIEW_TOP_N = 5;

// Fixed length of each user's sparkline series on GET /users. Sized to be
// legible at ~90px wide, not to be a chart.
export const USER_SPARKLINE_BUCKETS = 24;
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseBucket } from './validation';
import { HttpError } from './errors';

describe('parseBucket', () => {
  it('defaults to week when absent', () => {
    expect(parseBucket({})).toBe('week');
  });

  it('defaults to week when empty', () => {
    expect(parseBucket({ bucket: '' })).toBe('week');
  });

  it('accepts each valid granularity', () => {
    expect(parseBucket({ bucket: 'day' })).toBe('day');
    expect(parseBucket({ bucket: 'week' })).toBe('week');
    expect(parseBucket({ bucket: 'month' })).toBe('month');
  });

  it('rejects an unrecognised value with 400', () => {
    expect(() => parseBucket({ bucket: 'fortnight' })).toThrow(HttpError);
    try {
      parseBucket({ bucket: 'fortnight' });
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toContain('fortnight');
    }
  });

  it('rejects a valid value in the wrong case', () => {
    // Query params are matched exactly; loose matching here would be the only
    // case-insensitive param in the API.
    expect(() => parseBucket({ bucket: 'Week' })).toThrow(HttpError);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd backend && npx vitest run src/validation.test.ts`
Expected: FAIL — `parseBucket` is not exported.

- [ ] **Step 4: Implement `parseBucket` in `backend/src/validation.ts`**

Add `DEFAULT_BUCKET` to the existing `./config` import, add `import type { BucketSize } from 'activity-analytics-shared-types';` at the top, then append:

```ts
const BUCKET_SIZES: readonly BucketSize[] = ['day', 'week', 'month'];

/** Parses the optional bucket query param for /overview. Defaults to
 *  DEFAULT_BUCKET. Unlike parseLimit/parsePagination there is nothing to clamp —
 *  the value is an enum, so anything unrecognised is a 400. */
export function parseBucket(query: Record<string, unknown>): BucketSize {
  const raw = firstValue(query.bucket);
  if (raw === undefined || raw === '') {
    return DEFAULT_BUCKET;
  }
  const match = BUCKET_SIZES.find((size) => size === raw);
  if (!match) {
    throw new HttpError(400, `Invalid bucket "${raw}", expected one of: ${BUCKET_SIZES.join(', ')}`);
  }
  return match;
}
```

`DEFAULT_BUCKET` must be typed as `BucketSize`, not `string`. In `config.ts` it is declared as a bare string literal, so widen-proof it there:

```ts
export const DEFAULT_BUCKET: 'day' | 'week' | 'month' = 'week';
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `cd backend && npx vitest run src/validation.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/config.ts backend/src/validation.ts backend/src/validation.test.ts
git commit -m "feat: validate the bucket query param for overview"
```

---

## Task 3: `computeOverview`

**Files:**
- Create: `backend/src/overview.ts`, `backend/src/overview.test.ts`
- Modify: `shared/types.ts`, `backend/src/shared/time.ts`

**Interfaces:**
- Consumes: `bucketStartMs` / `nextBucketMs` (Task 1), `OVERVIEW_TOP_N` (Task 2).
- Produces: `computeOverview(usersEvents: Map<number, ActivityEvent[]>, bucket: BucketSize): Overview`; `msToIso(ms: number): string`.

- [ ] **Step 1: Add `msToIso` to `backend/src/shared/time.ts`**

```ts
/** Emits the API's timestamp format — ISO 8601 UTC without milliseconds, matching
 *  the source CSV's own `Z`-suffixed values so generated timestamps and
 *  passed-through ones are indistinguishable in a response. */
export function msToIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
```

- [ ] **Step 2: Add the response types to `shared/types.ts`**

```ts
// GET /overview — describes the dataset (or a time slice of it) rather than one
// user. See docs/superpowers/specs/2026-08-10-overview-product-design.md.
export interface ActivityBucket {
  bucket_start: string;
  count: number;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface Overview {
  total_events: number;
  total_users: number;
  distinct_actions: number;
  // Bounds of the events *within the requested range*, null when it's empty.
  // The full dataset's bounds live on /health, which is filter-independent.
  range_start: string | null;
  range_end: string | null;
  bucket: BucketSize;
  activity: ActivityBucket[];
  top_actions: ActionCount[];
  top_users: UserCount[];
}
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/overview.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `cd backend && npx vitest run src/overview.test.ts`
Expected: FAIL — cannot resolve `./overview`.

- [ ] **Step 5: Implement `backend/src/overview.ts`**

```ts
import type { ActivityEvent } from './types';
import type { ActionCount, ActivityBucket, BucketSize, Overview, UserCount } from 'activity-analytics-shared-types';
import { bucketStartMs, nextBucketMs } from './buckets';
import { msToIso } from './shared/time';
import { OVERVIEW_TOP_N } from './config';

/**
 * Dataset-level aggregation over an already range-filtered slice.
 *
 * `usersEvents` comes straight from ActivityStore.getAllUsersEventsInRange(), so
 * the range filtering and the per-user chronological ordering are already done;
 * this walks each user's slice exactly once.
 */
export function computeOverview(usersEvents: Map<number, ActivityEvent[]>, bucket: BucketSize): Overview {
  const actionCounts = new Map<string, number>();
  const userCounts = new Map<number, number>();
  const bucketCounts = new Map<number, number>();
  let totalEvents = 0;
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;

  for (const [userId, events] of usersEvents) {
    if (events.length === 0) continue;
    userCounts.set(userId, events.length);
    totalEvents += events.length;
    minMs = Math.min(minMs, events[0]!.timestampMs);
    maxMs = Math.max(maxMs, events[events.length - 1]!.timestampMs);

    for (const event of events) {
      actionCounts.set(event.action, (actionCounts.get(event.action) ?? 0) + 1);
      const start = bucketStartMs(event.timestampMs, bucket);
      bucketCounts.set(start, (bucketCounts.get(start) ?? 0) + 1);
    }
  }

  if (totalEvents === 0) {
    return {
      total_events: 0,
      total_users: 0,
      distinct_actions: 0,
      range_start: null,
      range_end: null,
      bucket,
      activity: [],
      top_actions: [],
      top_users: [],
    };
  }

  // Walk every bucket from first to last, emitting zeros for the silent ones. A
  // series that skipped them would redraw the shape of the data: a user who went
  // quiet for a month would look identical to one who never stopped.
  const activity: ActivityBucket[] = [];
  for (let start = bucketStartMs(minMs, bucket); start <= maxMs; start = nextBucketMs(start, bucket)) {
    activity.push({ bucket_start: msToIso(start), count: bucketCounts.get(start) ?? 0 });
  }

  // Descending by count, ties broken by first-seen order — Array.sort is stable
  // (guaranteed since ES2019) and both Maps were built in the store's
  // user-iteration order, so equal counts keep the order they appeared in the CSV.
  const top_actions: ActionCount[] = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, OVERVIEW_TOP_N);

  const top_users: UserCount[] = Array.from(userCounts.entries())
    .map(([user_id, count]) => ({ user_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, OVERVIEW_TOP_N);

  return {
    total_events: totalEvents,
    total_users: userCounts.size,
    distinct_actions: actionCounts.size,
    range_start: msToIso(minMs),
    range_end: msToIso(maxMs),
    bucket,
    activity,
    top_actions,
    top_users,
  };
}
```

> **On `top_users`' type:** `/overview`'s top-users list is a ranking, not a navigation aid, so it carries **no** sparkline — it returns `UserCount` (`user_id`, `count`). Task 5 adds `UserListEntry extends UserCount` with `activity` for `/users` only. Keep the two shapes distinct rather than shipping an empty array on `/overview`.

- [ ] **Step 6: Run the test and verify it passes**

Run: `cd backend && npx vitest run src/overview.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit
git add shared/types.ts backend/src/shared/time.ts backend/src/overview.ts backend/src/overview.test.ts
git commit -m "feat: compute dataset-level overview with bucketed activity"
```

---

## Task 4: Per-user sparkline series

**Files:**
- Create: `backend/src/sparkline.ts`, `backend/src/sparkline.test.ts`

**Interfaces:**
- Produces: `computeSparkline(events: ActivityEvent[], startMs: number, endMs: number, buckets: number): number[]`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/sparkline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSparkline } from './sparkline';
import type { ActivityEvent } from './types';

const at = (iso: string): ActivityEvent => ({
  userId: 1,
  timestamp: iso,
  timestampMs: Date.parse(iso),
  action: 'login',
  metadata: { page: 'home', duration: 10 },
});

const START = Date.parse('2024-01-01T00:00:00Z');
const END = Date.parse('2024-01-05T00:00:00Z');

describe('computeSparkline', () => {
  it('returns a fixed-length series of zeros for no events', () => {
    const series = computeSparkline([], START, END, 4);
    expect(series).toEqual([0, 0, 0, 0]);
  });

  it('always returns exactly `buckets` entries', () => {
    const series = computeSparkline([at('2024-01-02T00:00:00Z')], START, END, 24);
    expect(series).toHaveLength(24);
  });

  it('sums to the event count', () => {
    const events = [at('2024-01-01T00:00:00Z'), at('2024-01-02T12:00:00Z'), at('2024-01-04T00:00:00Z')];
    const series = computeSparkline(events, START, END, 4);
    expect(series.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('distributes events across buckets proportionally', () => {
    const events = [at('2024-01-01T00:00:00Z'), at('2024-01-02T00:00:00Z'), at('2024-01-04T00:00:00Z')];
    expect(computeSparkline(events, START, END, 4)).toEqual([1, 1, 0, 1]);
  });

  it('puts an event exactly at the end bound in the last bucket', () => {
    // Without a clamp this indexes one past the end of the array.
    expect(computeSparkline([at('2024-01-05T00:00:00Z')], START, END, 4)).toEqual([0, 0, 0, 1]);
  });

  it('puts everything in the first bucket when the span is zero', () => {
    expect(computeSparkline([at('2024-01-01T00:00:00Z')], START, START, 4)).toEqual([1, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd backend && npx vitest run src/sparkline.test.ts`
Expected: FAIL — cannot resolve `./sparkline`.

- [ ] **Step 3: Implement `backend/src/sparkline.ts`**

```ts
import type { ActivityEvent } from './types';

/**
 * A fixed-length activity series for one user, for the user list's sparkline.
 *
 * Deliberately *not* the same machinery as /overview's activity buckets: those
 * are calendar-aligned so the x-axis is readable, while this is a fixed number
 * of equal slices of the dataset span so every user's shape is directly
 * comparable at ~90px wide regardless of how long they were active.
 *
 * Counts are raw, not normalised — the frontend scales each series to its own
 * maximum, so a quiet user still shows a legible shape.
 */
export function computeSparkline(
  events: ActivityEvent[],
  startMs: number,
  endMs: number,
  buckets: number,
): number[] {
  const series = new Array<number>(buckets).fill(0);
  const span = endMs - startMs;

  for (const event of events) {
    const position = span === 0 ? 0 : ((event.timestampMs - startMs) / span) * buckets;
    // An event exactly at endMs lands on `buckets`, one past the last index.
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(position)));
    series[index]! += 1;
  }

  return series;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd backend && npx vitest run src/sparkline.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/sparkline.ts backend/src/sparkline.test.ts
git commit -m "feat: compute per-user activity sparkline series"
```

---

## Task 5: Store — dataset bounds and sparklines on `listUserCounts`

**Files:**
- Modify: `backend/src/store.ts`, `backend/src/store.test.ts`, `shared/types.ts`

**Interfaces:**
- Consumes: `computeSparkline` (Task 4), `USER_SPARKLINE_BUCKETS` (Task 2).
- Produces: `getDatasetBounds(): { startMs: number; endMs: number } | null`; `listUserCounts(): { userId: number; count: number; activity: number[] }[]`.

- [ ] **Step 1: Add `UserListEntry` to `shared/types.ts`**

`UserCount` stays exactly as it is (`user_id`, `count`) — it is what `/overview`'s rankings return. Add beneath it:

```ts
// GET /users — powers the user list. `activity` is a fixed-length series across
// the *dataset* bounds, not the current filter, so a user's shape stays
// recognisable as you change the range.
export interface UserListEntry extends UserCount {
  activity: number[];
}
```

- [ ] **Step 2: Write the failing tests**

Append to `backend/src/store.test.ts`:

```ts
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
```

Reuse the file's existing `event(...)` helper. If its signature differs from `(userId, iso)`, adapt these calls to match rather than adding a second helper.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `cd backend && npx vitest run src/store.test.ts`
Expected: FAIL — `getDatasetBounds` is not a function; `activity` is undefined.

- [ ] **Step 4: Implement in `backend/src/store.ts`**

Add imports:

```ts
import { computeSparkline } from './sparkline';
import { USER_SPARKLINE_BUCKETS } from './config';
```

Add the field beside the others:

```ts
private datasetBounds: { startMs: number; endMs: number } | null = null;
```

At the end of `replaceData`, after the per-user sort and before the swap-in, compute the bounds. Each bucket is already sorted, so this reads two elements per user rather than scanning:

```ts
let startMs = Number.POSITIVE_INFINITY;
let endMs = Number.NEGATIVE_INFINITY;
for (const bucket of next.values()) {
  startMs = Math.min(startMs, bucket[0]!.timestampMs);
  endMs = Math.max(endMs, bucket[bucket.length - 1]!.timestampMs);
}
// Computed once per load rather than per request: the bounds are the one fact
// about the dataset every screen needs and none of them can derive.
this.datasetBounds = next.size === 0 ? null : { startMs, endMs };
```

Add the accessor:

```ts
/** Bounds of the whole dataset, independent of any query filter. Null before
 *  the first successful load, or after loading an empty file. */
getDatasetBounds(): { startMs: number; endMs: number } | null {
  return this.datasetBounds;
}
```

Replace `listUserCounts`:

```ts
/** Every known user_id with its total event count and an activity sparkline,
 *  sorted ascending by user_id — a stable ordering for a list the user scans,
 *  independent of how active anyone is. */
listUserCounts(): { userId: number; count: number; activity: number[] }[] {
  const bounds = this.datasetBounds;
  return Array.from(this.eventsByUser.entries())
    .map(([userId, bucket]) => ({
      userId,
      count: bucket.length,
      activity: bounds
        ? computeSparkline(bucket, bounds.startMs, bounds.endMs, USER_SPARKLINE_BUCKETS)
        : new Array<number>(USER_SPARKLINE_BUCKETS).fill(0),
    }))
    .sort((a, b) => a.userId - b.userId);
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd backend && npx vitest run src/store.test.ts`
Expected: PASS, including the pre-existing binary-search range tests.

- [ ] **Step 6: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit && npm test
git add shared/types.ts backend/src/store.ts backend/src/store.test.ts backend/src/overview.ts
git commit -m "feat: track dataset bounds and per-user sparklines in the store"
```

---

## Task 6: Wire the routes

**Files:**
- Modify: `backend/src/app.ts`, `backend/src/app.test.ts`, `shared/types.ts`, `frontend/vite.config.ts`

**Interfaces:**
- Consumes: `computeOverview` (Task 3), `parseBucket` (Task 2), `getDatasetBounds` / `listUserCounts` (Task 5).
- Produces: `GET /overview`; `/health` and `/users` response shapes.

- [ ] **Step 1: Add the `Health` type to `shared/types.ts`**

```ts
// GET /health — load state plus the dataset's own bounds, which the UI uses to
// clamp its date inputs. Filter-independent by definition; /overview's
// range_start/range_end describe a filtered slice and are not interchangeable.
export interface Health {
  loaded: boolean;
  total_lines: number | null;
  rows_loaded: number | null;
  rows_skipped: number | null;
  skipped_reasons: string[] | null;
  dataset_start: string | null;
  dataset_end: string | null;
}
```

- [ ] **Step 2: Write the failing tests**

Append to `backend/src/app.test.ts`, following the file's existing setup helpers:

```ts
describe('GET /overview', () => {
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

describe('GET /health dataset bounds', () => {
  it('reports nulls before a load', async () => {
    const res = await request(createApp(new ActivityStore())).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.dataset_start).toBeNull();
    expect(res.body.dataset_end).toBeNull();
  });

  it('reports the dataset span once loaded', async () => {
    const res = await request(app).get('/health');
    expect(res.body.dataset_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.dataset_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('GET /users sparklines', () => {
  it('carries a fixed-length activity series per user', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body[0].activity).toHaveLength(24);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `cd backend && npx vitest run src/app.test.ts`
Expected: FAIL — `/overview` 404s (falls through to the catch-all), `dataset_start` undefined, `activity` undefined.

- [ ] **Step 4: Implement in `backend/src/app.ts`**

Extend the imports:

```ts
import { parseTimeRange, parseRequiredUserId, parsePagination, parseLimit, parseBucket } from './validation';
import { computeOverview } from './overview';
import { msToIso } from './shared/time';
import type { Health, UserListEntry } from 'activity-analytics-shared-types';
```

Add the route beside `/action_trends` (it is the other endpoint with no `user_id`):

```ts
/**
 * The one endpoint that describes the dataset rather than interrogating a slice
 * of it. No user_id, and — unlike /summary — an empty range is a 200 with zeros,
 * not a 404: "nothing happened in that window" is a correct answer about a
 * dataset, so this follows /sessions' side of the asymmetry in CLAUDE.md #4.
 */
app.get('/overview', (req: Request, res: Response, next: NextFunction) => {
  try {
    requireLoaded(store);
    const query = req.query as Record<string, unknown>;
    const { startMs, endMs } = parseTimeRange(query);
    const bucket = parseBucket(query);
    res.json(computeOverview(store.getAllUsersEventsInRange(startMs, endMs), bucket));
  } catch (err) {
    next(err);
  }
});
```

Update `/users`:

```ts
const users: UserListEntry[] = store
  .listUserCounts()
  .map(({ userId, count, activity }) => ({ user_id: userId, count, activity }));
res.json(users);
```

Update `/health`:

```ts
app.get('/health', (_req: Request, res: Response) => {
  const last = store.getLastLoadResult();
  const bounds = store.getDatasetBounds();
  const health: Health = {
    loaded: store.isLoaded(),
    total_lines: last?.totalLines ?? null,
    rows_loaded: last?.loaded ?? null,
    rows_skipped: last?.skipped ?? null,
    skipped_reasons: last?.skippedReasons ?? null,
    dataset_start: bounds ? msToIso(bounds.startMs) : null,
    dataset_end: bounds ? msToIso(bounds.endMs) : null,
  };
  res.json(health);
});
```

- [ ] **Step 5: Add the proxy entry to `frontend/vite.config.ts`**

Inside `server.proxy`, beside `/action_trends`:

```ts
// API-only: the Overview screen lives at `/`, not `/overview`, precisely so this
// path never doubles as a client route and needs no navigation bypass.
'/overview': 'http://localhost:4000',
```

- [ ] **Step 6: Run the full backend suite and verify it passes**

Run: `cd backend && npm test`
Expected: PASS — the pre-existing 51 tests plus the new ones.

- [ ] **Step 7: Verify by hand against the real data**

```bash
cd backend && npm run dev   # separate terminal
curl -s 'localhost:4000/overview?bucket=month' | head -c 400
curl -s localhost:4000/health
curl -s localhost:4000/users | head -c 200
```

Expected: `bucket: "month"`, 12 activity entries for the 2024 dataset, `dataset_start` `2024-01-07T04:10:14Z`, `dataset_end` `2024-12-27T05:34:13Z`, and a 24-entry `activity` array on the first user.

- [ ] **Step 8: Typecheck and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/app.ts backend/src/app.test.ts shared/types.ts frontend/vite.config.ts
git commit -m "feat: expose GET /overview and dataset bounds on /health"
```

**Step 1 is complete. The backend is done; the frontend still works unchanged.**

---

# Step 2 — Identity foundations

Applies to the screens that exist **today**, so the value lands before any restructure. If the plan stops here, the app is already visibly better.

## Task 7: The data monospace

**Files:**
- Modify: `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/index.css`

**Interfaces:**
- Produces: CSS custom property `--font-data`, applied to every numeric surface.

- [ ] **Step 1: Install the font**

```bash
cd frontend && npm install @fontsource/jetbrains-mono
```

Self-hosted through npm rather than a `<link>` to Google Fonts: the app must render without a third-party host, and the font file is versioned with the lockfile instead of committed as a loose binary.

- [ ] **Step 2: Import the two weights in `frontend/src/main.tsx`**

Above the existing `./index.css` import:

```ts
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
```

Verify those paths resolve after install (`ls node_modules/@fontsource/jetbrains-mono/`). If the package exposes different filenames, use the ones it ships — do not add a CDN fallback.

- [ ] **Step 3: Add the token in `frontend/src/index.css`**

In `:root`, directly under the type scale:

```css
  /* Data face — numbers, timestamps, durations, user IDs. UI text stays on the
     system stack. See docs/design.md, Type: the instrument reading of the
     tabular-numerals rule. */
  --font-data: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
```

- [ ] **Step 4: Apply it**

Add one rule and use the class on every numeric surface — table numeric cells, the four summary figures, pagination status, timestamps, durations, user IDs:

```css
.data {
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'ss01';
}
```

Keep the existing `tabular-nums` declarations — the mono reinforces the rule rather than replacing it, and the fallback stack still needs it.

- [ ] **Step 5: Verify visually**

Run both dev servers, open `http://localhost:5173/summary?user_id=22`, confirm the four figures and the table's numeric columns render in the mono while labels and headings do not. Check the network tab shows the font served from `localhost`, not a CDN.

- [ ] **Step 6: Typecheck and commit**

```bash
cd frontend && npx tsc -b --noEmit && npm test
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx frontend/src/index.css frontend/src
git commit -m "feat: set data in a self-hosted monospace"
```

---

## Task 8: Wordmark

**Files:**
- Create: `frontend/src/components/Wordmark.tsx`
- Modify: `frontend/src/components/Layout.tsx`, `frontend/src/index.css`

**Interfaces:**
- Produces: `<Wordmark />` — decorative inline SVG, no props.

- [ ] **Step 1: Create `frontend/src/components/Wordmark.tsx`**

```tsx
/**
 * Four session bars at varying heights and gaps — the signature timeline at
 * 16px. Domain-derived rather than decorative: the mark is the product's core
 * idea (activity punctuated by gaps) at logo scale.
 *
 * Decorative, so aria-hidden — the adjacent text title carries the accessible name.
 */
export function Wordmark() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false" className="wordmark">
      <rect x="0" y="0" width="3" height="16" rx="1" fill="currentColor" />
      <rect x="5" y="7" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="13" y="3" width="3" height="13" rx="1" fill="currentColor" />
      <rect x="17" y="10" width="3" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 2: Use it in `frontend/src/components/Layout.tsx`**

Replace the bare `<span className="brand">Activity Analytics</span>` with:

```tsx
<span className="brand">
  <Wordmark />
  Activity Analytics
</span>
```

and import `Wordmark` from `./Wordmark`.

- [ ] **Step 3: Style it in `frontend/src/index.css`**

```css
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.wordmark {
  color: var(--accent);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify and commit**

Confirm the mark renders beside the title at every viewport width, and that a screen reader announces "Activity Analytics" once, not twice.

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/components/Wordmark.tsx frontend/src/components/Layout.tsx frontend/src/index.css
git commit -m "feat: add a session-bars wordmark to the header"
```

---

## Task 9: Polish pass

**Files:**
- Create: `frontend/src/components/Skeleton.tsx`
- Modify: `frontend/src/index.css`, `frontend/src/hooks/useQuery.ts` (read only — no change expected)

**Interfaces:**
- Produces: `<Skeleton rows={number} />`.

Implements the parts of `docs/design.md`'s Motion and Components sections that were specified but never built.

- [ ] **Step 1: Create `frontend/src/components/Skeleton.tsx`**

```tsx
interface SkeletonProps {
  rows: number;
}

/** Placeholder rows at the table's own height, so a first load doesn't collapse
 *  the layout and reflow it when data arrives. Paginated tables don't use this —
 *  they keep the previous page's rows (useQuery's keepDataOnLoad). */
export function Skeleton({ rows }: SkeletonProps) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the motion and state CSS to `frontend/src/index.css`**

```css
/* docs/design.md, Motion: brief enough not to feel slow, long enough for the eye
   to register that the numbers on screen are now different ones. */
@keyframes result-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}

.result-region {
  animation: result-in 180ms ease-out;
}

.skeleton-row {
  height: 34px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--muted) 25%, var(--surface) 50%, var(--muted) 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.2s linear infinite;
  margin-bottom: var(--space-2);
}

@keyframes skeleton-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* Every interactive element, including the ones added in later tasks. */
a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
[role='tab']:focus-visible,
[role='option']:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .result-region,
  .skeleton-row {
    animation: none;
  }
}
```

- [ ] **Step 3: Apply `result-region` and `Skeleton`**

On each existing screen, wrap the result card in `<div className="result-region" key={…}>` — the `key` must change when the query changes, or React reuses the node and the animation never replays. Key on the serialised filters. Render `<Skeleton rows={5} />` in place of the result while `loading && !data`.

- [ ] **Step 4: Verify**

Run the app, submit a query, confirm the fade-and-rise plays once per new result and that `prefers-reduced-motion` (Chrome DevTools → Rendering → Emulate CSS media) drops it to instant. Tab through every control and confirm a visible ring.

- [ ] **Step 5: Typecheck, test, commit**

```bash
cd frontend && npx tsc -b --noEmit && npm test
git add frontend/src
git commit -m "feat: add result transitions, skeletons and focus rings"
```

**Step 2 is complete. The existing app now carries the visual identity.**

---

# Step 3 — Overview screen

Additive. The four old screens remain reachable and working.

## Task 10: API client and dataset bounds

**Files:**
- Modify: `frontend/src/api.ts`, `frontend/src/types.ts`
- Create: `frontend/src/hooks/useDatasetBounds.ts`

**Interfaces:**
- Consumes: `/overview`, `/health` (Task 6).
- Produces: `fetchOverview(params, signal): Promise<Overview>`; `fetchHealth(signal): Promise<Health>`; `useDatasetBounds(): { start: string | null; end: string | null }`.

- [ ] **Step 1: Re-export the new types in `frontend/src/types.ts`**

Add `BucketSize`, `ActivityBucket`, `ActionCount`, `Overview`, `Health`, `UserListEntry` to the existing re-export from `activity-analytics-shared-types`.

- [ ] **Step 2: Add the fetchers to `frontend/src/api.ts`**

```ts
export function fetchOverview(
  params: { startTime?: string; endTime?: string; bucket?: BucketSize },
  signal?: AbortSignal,
): Promise<Overview> {
  const query = buildQuery({ start_time: params.startTime, end_time: params.endTime, bucket: params.bucket });
  return getJson<Overview>(`/overview${query ? `?${query}` : ''}`, signal);
}

export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return getJson<Health>('/health', signal);
}
```

Update `fetchUsers`' return type to `UserListEntry[]`.

- [ ] **Step 3: Create `frontend/src/hooks/useDatasetBounds.ts`**

```ts
import { useEffect, useState } from 'react';
import { fetchHealth } from '../api';

/**
 * The dataset's own time span, used to clamp the date inputs so a window the
 * data cannot contain becomes untypeable. Read from /health rather than
 * /overview because it must not move when the user changes the filter.
 *
 * Fails silently: without bounds the inputs are simply unclamped, which is the
 * behaviour we have today. A failed clamp must not block the screen.
 */
export function useDatasetBounds(): { start: string | null; end: string | null } {
  const [bounds, setBounds] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((health) => setBounds({ start: health.dataset_start, end: health.dataset_end }))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return bounds;
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/api.ts frontend/src/types.ts frontend/src/hooks/useDatasetBounds.ts
git commit -m "feat: add overview and health API clients"
```

---

## Task 11: `useUrlFilters` learns `bucket`

**Files:**
- Modify: `frontend/src/hooks/useUrlFilters.ts`, `frontend/src/hooks/useUrlFilters.test.tsx`

**Interfaces:**
- Produces: option `bucketed?: boolean`; returns `bucket: BucketSize`, `setBucket(next: BucketSize): void`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/hooks/useUrlFilters.test.tsx`, matching the file's existing render helper:

```tsx
it('reads bucket from the URL when bucketed', async () => {
  const fetcher = vi.fn().mockResolvedValue({});
  renderHook(true, fetcher, { bucketed: true }, '/?bucket=month');
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(fetcher.mock.calls[0]![0].bucket).toBe('month');
});

it('defaults bucket to week and ignores an unrecognised value', async () => {
  const fetcher = vi.fn().mockResolvedValue({});
  renderHook(true, fetcher, { bucketed: true }, '/?bucket=fortnight');
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(fetcher.mock.calls[0]![0].bucket).toBe('week');
});

it('does not send bucket when not bucketed', async () => {
  const fetcher = vi.fn().mockResolvedValue({});
  renderHook(true, fetcher, {}, '/?bucket=month');
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(fetcher.mock.calls[0]![0].bucket).toBeUndefined();
});
```

Adapt `renderHook`'s signature to the file's existing helper; add the `options` and initial-URL parameters if it doesn't take them yet.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && npx vitest run src/hooks/useUrlFilters.test.tsx`
Expected: FAIL — `bucket` is undefined on the fetcher's params.

- [ ] **Step 3: Implement**

Extend the fetcher type with `bucket?: BucketSize`, add `bucketed?: boolean` to `UseUrlFiltersOptions`, then:

```ts
const BUCKET_SIZES: readonly BucketSize[] = ['day', 'week', 'month'];
const DEFAULT_BUCKET: BucketSize = 'week';

const bucketParam = searchParams.get('bucket');
// An unrecognised value in a pasted URL falls back to the default rather than
// erroring — the backend would 400, and a bad bookmark shouldn't be a dead end.
const bucket: BucketSize =
  bucketed && BUCKET_SIZES.includes(bucketParam as BucketSize) ? (bucketParam as BucketSize) : DEFAULT_BUCKET;
```

The `as BucketSize` in `includes` is a narrowing aid, not a silencer — but prefer `BUCKET_SIZES.find((b) => b === bucketParam)` to avoid the cast entirely, matching `parseBucket` on the backend.

Add `bucket` to the effect's dependency array and pass `bucket: bucketed ? bucket : undefined` into the fetcher. Add:

```ts
function setBucket(next: BucketSize) {
  const params = new URLSearchParams(searchParams);
  params.set('bucket', next);
  setSearchParams(params);
}
```

Return `bucket` and `setBucket`.

- [ ] **Step 4: Run and verify pass, then commit**

```bash
cd frontend && npx vitest run src/hooks/useUrlFilters.test.tsx && npx tsc -b --noEmit
git add frontend/src/hooks/useUrlFilters.ts frontend/src/hooks/useUrlFilters.test.tsx
git commit -m "feat: carry the bucket granularity in the URL"
```

---

## Task 12: `TopFilterBar`

**Files:**
- Create: `frontend/src/components/TopFilterBar.tsx`
- Modify: `frontend/src/index.css`, `frontend/package.json`

**Interfaces:**
- Consumes: `useDatasetBounds` (Task 10), `validateFilters` (`frontend/src/validation.ts`), `utcIsoToDatetimeLocal` / `datetimeLocalToUtcIso` (`frontend/src/time.ts`).
- Produces: `<TopFilterBar initialValues onSubmit bounds bucket onBucketChange showBucket />`.

- [ ] **Step 1: Install the popover primitive**

```bash
cd frontend && npm install @radix-ui/react-popover
```

- [ ] **Step 2: Build the component**

Two chips. The first states the active range — `All data · 7 Jan – 27 Dec 2024` when no bounds are set, otherwise the chosen window. The second, `Custom…`, is a `Popover.Trigger` whose content holds the two `datetime-local` inputs and an Apply button.

The inputs carry `min` and `max` from `bounds`, converted with `utcIsoToDatetimeLocal`:

```tsx
<input
  id="start-time"
  type="datetime-local"
  min={bounds.start ? utcIsoToDatetimeLocal(bounds.start) : undefined}
  max={bounds.end ? utcIsoToDatetimeLocal(bounds.end) : undefined}
  value={startTime}
  onChange={(e) => setStartTime(e.target.value)}
/>
```

> **This clamp is the fix for the impossible-window problem.** Without it the UI accepts a 2026 range against a 2024 dataset and reports an empty result, which reads as a bug rather than an empty range. `min`/`max` are a hint, not a guarantee — a typed value can still fall outside — so keep `validateFilters` running on submit as the real gate.

Keep the existing validation call and its `role="alert"` error element, lifted from `ActivityFilters`. Labels stay explicit `htmlFor`/`id` pairs.

The bucket control is a `<fieldset>` of three radio inputs styled as a segmented control, rendered only when `showBucket`. Radios rather than buttons so arrow-key navigation and grouping come from the platform.

- [ ] **Step 3: Style it**

Chips: `border-radius: 999px`, 1px `--muted` border, `--panel` background; the active range chip gets a 1px `--accent` border and `--accent-soft` fill. The bar sits below the header on `--panel` with a 1px `--muted` bottom rule. Below 900px it wraps to two lines — it must never scroll horizontally.

- [ ] **Step 4: Verify and commit**

Not wired to a screen yet. Render it temporarily inside `ActionTrendsForm` to confirm the popover opens, traps focus, closes on Escape, and that the date inputs refuse a 2026 value via the picker.

```bash
cd frontend && npx tsc -b --noEmit && npm test
git add frontend/package.json frontend/package-lock.json frontend/src/components/TopFilterBar.tsx frontend/src/index.css
git commit -m "feat: add a shared top filter bar with clamped date inputs"
```

---

## Task 13: `ActivityChart`

**Files:**
- Create: `frontend/src/components/ActivityChart.tsx`
- Modify: `frontend/src/format.ts`

**Interfaces:**
- Consumes: `Overview['activity']`, `BucketSize`.
- Produces: `<ActivityChart activity bucket />`.

Follow the visualization method: **form first, colour last.** This is change-over-time for a single series → a line, one hue. `#57449a` passes the palette validator (lightness band, chroma floor, contrast vs surface). There is no categorical palette here and none should be introduced.

- [ ] **Step 1: Register the line elements**

`ActionTrendsChart` currently registers only what a bar chart needs. In `ActivityChart`:

```ts
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);
```

- [ ] **Step 2: Build the chart with the mark spec**

```ts
const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: INK_MUTED } },
    y: { beginAtZero: true, grid: { color: MUTED, drawTicks: false }, border: { display: false }, ticks: { color: INK_MUTED } },
  },
  plugins: {
    legend: { display: false }, // one series — the heading names it
    tooltip: { displayColors: false, backgroundColor: PANEL, titleColor: INK, bodyColor: INK, borderColor: MUTED, borderWidth: 1, padding: 10, bodyFont: { family: FONT_DATA } },
  },
  elements: {
    line: { borderWidth: 2, tension: 0 },
    point: { radius: 0, hoverRadius: 4, hitRadius: 12 },
  },
};
```

Read `INK`, `INK_MUTED`, `MUTED`, `PANEL`, `FONT_DATA` from the CSS custom properties via `getComputedStyle(document.documentElement).getPropertyValue('--accent')` rather than hardcoding hexes — the tokens stay the single source of truth.

- [ ] **Step 3: Label the peak only**

Compute the max bucket and render an absolutely-positioned label above it, or use a tiny inline plugin. **Never label every point.**

- [ ] **Step 4: Format the x labels by bucket**

Add to `frontend/src/format.ts`:

```ts
/** Axis label for a bucket start, at the granularity the bucket implies —
 *  a weekly axis showing full timestamps is unreadable. All UTC. */
export function formatBucketLabel(iso: string, bucket: BucketSize): string {
  const date = new Date(iso);
  if (bucket === 'month') {
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
```

- [ ] **Step 5: Verify and commit**

Render it against real `/overview` data at all three granularities. Check: no vertical gridlines, no point markers at rest, tooltip on hover with the value in the mono, no horizontal page scroll at 375px.

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/components/ActivityChart.tsx frontend/src/format.ts
git commit -m "feat: add a restyled activity-over-time line chart"
```

---

## Task 14: The Overview screen

**Files:**
- Create: `frontend/src/components/Overview.tsx`, `frontend/src/components/StatTile.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: everything from Tasks 10–13.

- [ ] **Step 1: Create `StatTile`**

```tsx
interface StatTileProps {
  label: string;
  value: string;
}

/** A headline figure. Per the visualization method these are stat tiles, not a
 *  one-bar chart — four unrelated magnitudes have no shared scale to plot on. */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value data">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build `Overview`**

```tsx
const { data, loading, error, initialValues, handleSubmit, bucket, setBucket } = useUrlFilters(false, fetchOverview, {
  bucketed: true,
});
```

Renders `TopFilterBar` (with `showBucket`), then a four-tile KPI row (events, users, action types, span in days from `range_start`/`range_end`), then `ActivityChart`, then two cards: top actions, and most-active users as `<Link to={{ pathname: '/users', search: … }}>` carrying the current `start_time`/`end_time`.

Empty state, when `total_events === 0`: *"No activity in this range. The dataset covers 7 Jan – 27 Dec 2024."* — name the fact that resolves it, per `docs/design.md`'s Copy section.

- [ ] **Step 3: Route it**

In `App.tsx` replace the index redirect:

```tsx
<Route index element={<Overview />} />
```

Leave `/summary`, `/trends`, `/sessions`, `/anomalies` alone for now — Task 19 handles them. Change `<Route path="*">` to redirect to `/`.

- [ ] **Step 4: Add the nav item**

In `Layout.tsx` prepend `{ to: '/', label: 'Overview' }` to `NAV_ITEMS`. The `/` entry needs `end` on its `NavLink`, or it matches every route and stays permanently active.

- [ ] **Step 5: Verify**

Load `http://localhost:5173/` with no query string: tiles, chart and lists render with no input. Change bucket → URL gains `?bucket=month`, chart redraws. Reload → same view. Click a top user → lands on `/users` (404s until Task 19; that's expected).

- [ ] **Step 6: Typecheck, test, commit**

```bash
cd frontend && npx tsc -b --noEmit && npm test
git add frontend/src
git commit -m "feat: land on an overview screen instead of an empty form"
```

---

## Task 15: Restyle `ActionTrendsChart`

**Files:**
- Modify: `frontend/src/components/ActionTrendsChart.tsx`

- [ ] **Step 1: Apply the same mark spec**

4px rounded bar ends (`borderRadius: 4`), a 2px surface gap between bars (`categoryPercentage` / `barPercentage` tuned so adjacent bars don't touch), horizontal gridlines only, legend off, tooltip styled as the card in Task 13, values in `--font-data`. Single hue — the same `--accent`, read from the token.

- [ ] **Step 2: Add the drill-down list beneath it**

A compact list of the returned pairs, each user a `<Link>` to `/users?user_id=N` carrying the current range.

> Real links, not a Chart.js `onClick`. Canvas hit-testing is not keyboard reachable, cannot be middle-clicked or copied, and has no focus ring — it would undo Phase 7's accessibility work, and it is more code.

- [ ] **Step 3: Verify and commit**

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/components/ActionTrendsChart.tsx
git commit -m "feat: restyle the trends chart and add drill-down links"
```

**Step 3 is complete. This is the safe stopping point — everything so far is additive and the app is shippable.**

---

# Step 4 — Users master–detail

**The only destructive step.** It deletes three components and rebuilds them as one screen. Do not begin it without time to finish it.

## Task 16: Radix tabs and `useUrlFilters` learns `tab`

**Files:**
- Modify: `frontend/package.json`, `frontend/src/hooks/useUrlFilters.ts`, `frontend/src/hooks/useUrlFilters.test.tsx`

**Interfaces:**
- Produces: option `tabbed?: boolean`; returns `tab: 'sessions' | 'anomalies'`, `setTab(next): void`.

- [ ] **Step 1: Install**

```bash
cd frontend && npm install @radix-ui/react-tabs
```

- [ ] **Step 2: Write the failing tests**

```tsx
it('defaults tab to sessions', async () => { /* asserts tab === 'sessions' with no ?tab= */ });
it('reads tab from the URL', async () => { /* ?tab=anomalies → 'anomalies' */ });
it('falls back to sessions for an unrecognised tab', async () => { /* ?tab=nonsense → 'sessions' */ });
it('resets page to 1 when the tab changes', async () => {
  // Page 2 of sessions is meaningless as page 2 of anomalies.
  const { setTab } = renderHook(true, fetcher, { paginated: true, tabbed: true }, '/?user_id=1&page=3');
  act(() => setTab('anomalies'));
  await waitFor(() => expect(currentSearch()).toContain('page=1'));
});
```

Write these out fully against the file's existing helper — the sketch above names the four cases, not the final code.

- [ ] **Step 3: Implement**

Mirror the `bucket` implementation from Task 11. `setTab` writes `tab` **and** sets `page` to `1` in the same `setSearchParams` call, so only one navigation occurs and the effect fires once.

- [ ] **Step 4: Run, typecheck, commit**

```bash
cd frontend && npx vitest run src/hooks/useUrlFilters.test.tsx && npx tsc -b --noEmit
git add frontend/package.json frontend/package-lock.json frontend/src/hooks
git commit -m "feat: carry the active tab in the URL"
```

---

## Task 17: `Sparkline` and `UserList`

**Files:**
- Create: `frontend/src/components/Sparkline.tsx`, `frontend/src/components/UserList.tsx`, `frontend/src/components/UserList.test.tsx`
- Modify: `frontend/src/hooks/useUsers.ts`

**Interfaces:**
- Consumes: `UserListEntry[]` from `useUsers`.
- Produces: `<Sparkline values={number[]} />`; `<UserList users selectedUserId onSelect loading />`.

- [ ] **Step 1: Create `Sparkline`**

```tsx
interface SparklineProps {
  values: number[];
}

/** Scaled to its own maximum, not a shared one: a quiet user's shape is as
 *  informative as a busy user's, and a global scale would flatten most of the
 *  list into a straight line. Decorative — the count beside it is the value. */
export function Sparkline({ values }: SparklineProps) {
  const max = Math.max(...values, 1);
  const step = 90 / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(18 - (v / max) * 16).toFixed(1)}`).join(' ');

  return (
    <svg width="90" height="18" viewBox="0 0 90 18" aria-hidden="true" focusable="false" className="sparkline">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Write the failing `UserList` test**

Cover: renders every user; typing in the search field filters to matching IDs; the selected row carries `aria-selected="true"`; ArrowDown moves the active row and Enter selects it; an empty filter result shows "No users match."

- [ ] **Step 3: Implement `UserList`**

A search `<input type="search">` above a `<ul role="listbox">` of `<li role="option">` rows, each holding the user ID, its `Sparkline`, and its count. Filtering is a substring match on the ID string.

> No combobox here, deliberately. The list is always visible in the master pane, so this is a filtered listbox — a far simpler and more robust pattern than the popup combobox the `<datalist>` was imitating. This is why no Radix combobox primitive is needed.

Keyboard: ArrowUp/ArrowDown move `aria-activedescendant`, Enter selects, Home/End jump. The list must be scrollable with `overflow-y: auto` and a fixed max height — 125 rows cannot push the page.

- [ ] **Step 4: Run, typecheck, commit**

```bash
cd frontend && npx vitest run src/components/UserList.test.tsx && npx tsc -b --noEmit
git add frontend/src/components/Sparkline.tsx frontend/src/components/UserList.tsx frontend/src/components/UserList.test.tsx frontend/src/hooks/useUsers.ts
git commit -m "feat: add a searchable user list with activity sparklines"
```

---

## Task 18: `UserDetail` and the two panels

**Files:**
- Create: `frontend/src/components/UserDetail.tsx`, `frontend/src/components/SessionsPanel.tsx`, `frontend/src/components/AnomaliesPanel.tsx`

**Interfaces:**
- Consumes: `useUrlFilters` with `{ paginated: true, tabbed: true }`, `StatTile`, `Pagination`, `SessionTimeline`, `Skeleton`.

- [ ] **Step 1: Lift the tables**

Move the result-rendering JSX out of `SessionsForm` and `AnomaliesForm` verbatim into `SessionsPanel` and `AnomaliesPanel`. **Do not rewrite it** — the stable keys (`${start}|${end}`, `${timestamp}|${action}`), the formatters, `SessionTimeline` and `Pagination` all carry Phase 4–7 decisions. Take the markup as-is; the only changes are the props it now receives.

- [ ] **Step 2: Build `UserDetail`**

Heading with the user ID and event count, then a four-tile row from `/summary` (total actions, avg duration, top action, top page), then `Tabs.Root` with two triggers carrying counts and two content panels.

Each panel owns its own `useUrlFilters` call for its endpoint. The tabs share `?page`/`?page_size`; Task 16's `setTab` resets the page.

Anomalies empty state: `0` on the tab and *"No anomalies in this range."* in the panel. Restrained — with population stddev at 2σ, most users genuinely have none, and that is a correct answer rather than a failure.

- [ ] **Step 3: Verify and commit**

Not routed yet. Confirm `tsc` is clean.

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/components/UserDetail.tsx frontend/src/components/SessionsPanel.tsx frontend/src/components/AnomaliesPanel.tsx
git commit -m "feat: add user detail with sessions and anomalies tabs"
```

---

## Task 19: Assemble `/users`, redirect the old routes, delete the forms

**Files:**
- Create: `frontend/src/components/UsersScreen.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/vite.config.ts`
- Delete: `UserSummaryForm.tsx`, `SessionsForm.tsx`, `AnomaliesForm.tsx`, `ActivityFilters.tsx`

- [ ] **Step 1: Build `UsersScreen`**

`TopFilterBar` (no bucket), then a two-column layout: `UserList` on the left, `UserDetail` on the right when `?user_id=` is set. With no user selected, the right side reads *"Select a user to see their activity."*

Below 900px the list collapses into a `<details>` disclosure above the detail, open until a user is selected — the same pattern `ScreenLayout` already uses for the rail.

- [ ] **Step 2: Add the proxy bypass**

`/users` is now **both** an API prefix and a client route — the Phase 5 collision. In `frontend/vite.config.ts`:

```ts
'/users': { target: 'http://localhost:4000', bypass: bypassNavigation },
```

**Without this, a fresh tab on `/users?user_id=22` is served the backend's JSON instead of the app.** Test it by hard-reloading that URL, not by clicking to it.

- [ ] **Step 3: Rewrite the routes in `App.tsx`**

```tsx
<Route index element={<Overview />} />
<Route path="/users" element={<UsersScreen />} />
<Route path="/trends" element={<ActionTrendsForm />} />
<Route path="/summary" element={<RedirectToUsers />} />
<Route path="/sessions" element={<RedirectToUsers tab="sessions" />} />
<Route path="/anomalies" element={<RedirectToUsers tab="anomalies" />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

`RedirectToUsers` preserves the query string and adds `tab` when given, so previously shared links still resolve:

```tsx
function RedirectToUsers({ tab }: { tab?: 'sessions' | 'anomalies' }) {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  if (tab) next.set('tab', tab);
  return <Navigate to={{ pathname: '/users', search: next.toString() }} replace />;
}
```

- [ ] **Step 4: Update the nav**

`NAV_ITEMS` becomes Overview (`/`, with `end`), Users (`/users`), Trends (`/trends`).

- [ ] **Step 5: Delete the old components**

Remove the four files and every import of them. `tsc` finding no dangling references is the check that nothing was missed.

- [ ] **Step 6: Write the redirect test**

```tsx
it('redirects a legacy sessions link to the users screen', () => {
  render(<MemoryRouter initialEntries={['/sessions?user_id=22&page=2']}><App /></MemoryRouter>);
  // asserts the resolved location is /users?user_id=22&page=2&tab=sessions
});
```

- [ ] **Step 7: Verify by hand — the full regression pass**

1. `/` renders with no input.
2. `/users` → pick user 22 from the list → tiles, timeline, sessions table.
3. Switch to Anomalies → tab shows `0`, panel shows the empty copy, `?tab=anomalies` in the URL.
4. Page through sessions → `?page=` updates; switch tabs → page resets to 1.
5. Set a custom range → both tabs and the tiles respect it.
6. **Hard-reload** `/users?user_id=22&tab=anomalies&page=2` → identical view (this is the proxy-bypass check).
7. Visit `/summary?user_id=22` → redirected to `/users?user_id=22`.
8. Browser back/forward through all of the above.
9. Resize to 375px → no horizontal scroll anywhere.

- [ ] **Step 8: Typecheck, test, commit**

```bash
cd frontend && npx tsc -b --noEmit && npm test
cd ../backend && npm test
git add -A frontend/src frontend/vite.config.ts
git commit -m "feat: replace three query screens with a users master-detail view"
```

**Step 4 is complete. The restructure has landed.**

---

# Step 5 — Documentation

## Task 20: Update every document

**Files:**
- Modify: `README.md`, `docs/design.md`, `docs/roadmap.md`, `CLAUDE.md`, `.gitignore`

- [ ] **Step 1: `.gitignore`**

```
.superpowers/
docs/superpowers/
```

- [ ] **Step 2: `CLAUDE.md` §4 — new invariants**

- `/overview` returns `200` with zeros on an empty range, not `404` — it describes a dataset, so "nothing in that window" is a correct answer. Same reasoning as `/sessions`, opposite to `/summary`.
- **Empty buckets are emitted, never skipped.** A series that omits silent periods misrepresents the shape of the data.
- **Bucket boundaries are UTC** — day to midnight, week to the preceding Monday, month to the 1st. Month stepping is a calendar increment, not a fixed delta.
- **Dataset bounds live on `/health` and are filter-independent.** `/overview`'s `range_start`/`range_end` describe the filtered slice; the two are not interchangeable.
- **`/users` sparklines span the dataset, not the filter**, so a user's shape stays recognisable as the range changes.

Update §1's endpoint list and §2's screen description to the three-screen structure.

- [ ] **Step 3: `docs/design.md` — the amendments**

Add a dated "Phase 8 amendments" section recording each change **with its reason**, per §4.1 of the spec: the anti-dashboard line is qualified, the no-display-type line is amended to admit a data monospace, no-zebra-striping and no-dark-mode are explicitly retained after reconsideration, and the Signature section is extended to cover sparklines and the anomaly emphasis chart.

> Do not silently diverge. Every CSS value in this project is supposed to trace back to this document; an unrecorded amendment breaks that property, which is the only thing that makes the document worth having.

- [ ] **Step 4: `docs/roadmap.md`**

Add the Phase 8 block with every item checked, matching the existing phases' style — outcome plus the reasoning behind each decision, including what was deliberately not done. Close the outstanding Phase 7 README item.

- [ ] **Step 5: `README.md`**

API section: `GET /overview` with its params and full response shape; `/health`'s two new fields; `/users`' `activity`. Structure section: three screens, not four. Note the legacy redirects. Retake `docs/screenshot.png` from the Overview screen.

- [ ] **Step 6: Final verification**

```bash
cd backend && npx tsc --noEmit && npm test
cd ../frontend && npx tsc -b --noEmit && npm test
```

Both green. Then start both dev servers and walk the regression pass from Task 19 Step 7 once more against the real CDN data.

- [ ] **Step 7: Commit**

```bash
git add README.md docs CLAUDE.md .gitignore
git commit -m "docs: document phase 8 and amend the design direction"
```

---

## Deferred — only if everything above lands early

The anomalies duration-distribution strip, as an **emphasis** chart: every duration for the user plotted along one axis, the flagged outliers in `--accent`, the rest in de-emphasis grey. It makes "2 standard deviations out" something you see rather than take on faith. Designed in spec §4.4, not planned here.

---

## Notes for whoever executes this

- **Read the spec first.** This plan is the mechanics; the spec holds the reasoning, and the reasoning is what you will be asked about.
- **Steps 1–3 are additive and each ends shippable. Step 4 is not.** If time is short, stop after Task 15 — that is a coherent, better product, not a half-finished one.
- **The three easiest mistakes**, all of which have bitten this repo before:
  1. Forgetting a `vite.config.ts` proxy entry, or forgetting `bypass` on a path that is both an API prefix and a client route. It only shows up on a hard reload of a fresh tab.
  2. Routing a `datetime-local` value through `new Date()`, which reinterprets it as browser-local and silently shifts the window.
  3. Changing a response shape while calling a phase behaviour-preserving. If a contract needs to change, say so and update the docs in the same commit.

