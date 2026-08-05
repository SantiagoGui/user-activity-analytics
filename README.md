# User Activity Log Analytics Platform

Full-stack app that fetches `activities.csv` from a CDN URL, indexes it in memory,
and serves per-user summaries and cross-user action trends. Built for the Plank AI
Accelerator 2-hour programming test.

- `backend/` — Node.js + TypeScript + Express REST API, in-memory store, no database.
- `frontend/` — React + TypeScript (Vite) UI: four forms (summary, trends, sessions,
  anomalies) + a Chart.js bar chart.
- `docs/data-source.md` — structural analysis of the real CSV (schema, value ranges,
  the unquoted-JSON parsing edge case).
- `docs/tasks.md` — the implementation task breakdown this was built against.

## Setup & run

Requires Node.js 18+ (uses the built-in `fetch`).

**Backend** (starts on `http://localhost:4000`, fetches the CSV on startup):
```bash
cd backend
npm install
npm run dev
```

**Frontend** (starts on `http://localhost:5173`, proxies `/summary`,
`/action_trends`, `/sessions`, `/anomalies`, `/users`, `/health`, `/load` to the
backend — see `frontend/vite.config.ts`):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. If the backend's startup fetch failed (e.g. no network
at boot), `POST http://localhost:4000/load` retries it; until a load succeeds, the
other endpoints return `503`.

## API

- `GET /summary?user_id=<int>&start_time=<ISO8601>&end_time=<ISO8601>` — `user_id`
  required, times optional. `400` on bad/missing params or `start_time > end_time`;
  `404` if the user has no matching rows.
- `GET /action_trends?start_time=<ISO8601>&end_time=<ISO8601>&limit=<int>` — all
  optional; top `(user_id, action)` pairs by count in range. `limit` defaults to 3,
  `400` if not a positive integer, silently capped at 50.
- `GET /sessions?user_id=<int>&start_time=<ISO8601>&end_time=<ISO8601>&page=<int>&page_size=<int>`
  *(bonus)* — `user_id` required. Groups that user's events (after time filtering)
  into sessions wherever the gap since the previous action is ≤30 min; returns the
  paginated envelope `{ items: { start, end, actions, total_duration }[], page,
  page_size, total, total_pages }`. `page` defaults to 1, `page_size` to 20 (capped
  at 100); an out-of-range `page` returns `items: []` with accurate
  `total`/`total_pages`, not a `400`. `404` only if the user has no data at all — a
  known user with zero sessions *in range* returns `200` with `items: []`, since an
  empty result is a normal answer for a list endpoint (see below).
- `GET /anomalies?user_id=<int>&start_time=<ISO8601>&end_time=<ISO8601>&page=<int>&page_size=<int>`
  *(bonus)* — `user_id` required. Per `(user_id, action)` pair, flags durations more
  than 2 population-standard-deviations from that pair's mean; returns the **same
  paginated envelope as `/sessions`** (`items: { timestamp, action, duration }[]`,
  plus `page`/`page_size`/`total`/`total_pages`) — a deliberate consistency choice
  between the two sibling list endpoints, even though only `/sessions` strictly
  needed pagination. Same `200`-with-empty-`items` vs `404` semantics as `/sessions`.
- `GET /users` — every known `user_id` with its event count, sorted ascending;
  `[{ user_id, count }]`. Powers the frontend's (future) user autocomplete.
- `GET /health` — `{ loaded, total_lines, rows_loaded, rows_skipped, skipped_reasons }`.
  The one endpoint that does **not** 503 before a successful load — reporting
  `loaded: false` (with the numeric fields `null`) is its normal, expected response
  in that state, not an error.
- `POST /load` — re-fetch and re-parse the CSV, replacing the in-memory store on
  success only (a failed reload keeps serving the last good data).

## Data structures & optimization approach

The CSV is parsed once (at startup / on `/load`), not on every request. The parsed
store (`backend/src/store.ts`) is a `Map<user_id, ActivityEvent[]>`, with each user's
events kept sorted ascending by timestamp:

- `/summary`, `/sessions`, and `/anomalies` all need one user's events in time order —
  that's an `O(1)` map lookup, then an `O(log n)` binary search to find the start/end
  of a `start_time`/`end_time` window (no full re-scan of that user's rows per
  request). Sessions and per-action anomaly stats are then computed with a single
  linear pass over that already-narrow slice.
- `/action_trends` needs every user's events — the handler iterates the map's
  per-user buckets (one binary-search slice per user), tallies `(user_id, action)`
  counts, then sorts. At ≤5000 rows / ≤125 users this is well under the 1-second
  budget (measured: all four endpoints respond in well under 50ms against the live
  3,063-row CSV).

Tie-breaking (most-frequent action/page, top-3 trends) is made deterministic by
relying on `Map`/array insertion order: events are inserted in first-CSV-appearance
(user) then chronological (per-user) order, and JS `Map` iteration and
`Array.prototype.sort` are both stable — so equal counts consistently resolve to the
earliest-occurring key rather than incidental hash-order.

### The CSV's real parsing hazard

`docs/data-source.md` documents the full analysis, but the one thing that would have
broken a naive implementation: the `metadata` column is **unquoted JSON containing
commas** (e.g. `72,2024-01-04T05:20:04Z,logout,{"page": "dashboard", "duration": 107}`).
A plain `line.split(',')`, or a CSV library configured for standard RFC 4180 quoting,
shreds this into 5+ fields. `backend/src/csvParser.ts` splits each line on only its
first 3 commas and treats everything after as the raw metadata JSON string — verified
against all 3,063 real rows with zero parse failures.

Rows that fail validation (bad `user_id`/timestamp/JSON, wrong column count) are
skipped individually and counted/sampled for diagnostics, rather than failing the
whole load — only a structurally wrong header (missing/renamed columns) aborts the
parse entirely.

## Bonus: sessions & anomaly detection

**Sessions** (`backend/src/sessions.ts`): a single linear pass over one user's
(already time-sorted) events. A new session starts whenever the gap since the
previous action exceeds 30 minutes — the boundary is inclusive (`<=`), matching the
spec's worked example exactly (12:00 login + 12:25 click, a 25-minute gap, is one
session; a 13:00 action after that, a 35-minute gap, starts a new one). Verified with
a standalone script reproducing that exact example before wiring it into the route.

**Anomalies** (`backend/src/anomalies.ts`): groups a user's events by `action`,
computes the mean and *population* standard deviation of `duration` per group, and
flags any event whose duration deviates from that group's mean by more than 2×stdDev.
Population (not sample) stddev was chosen because this is describing the spread of
the given sample itself, not estimating a larger population's variance — and it
conveniently means 0- or 1-event groups get `stdDev = 0`, so nothing in them can
exceed a `>0` threshold; no separate divide-by-zero guard is needed.

One honest caveat: the spec's own worked example (durations `[30, 20, 25, 100]` →
"flag the 100s action") doesn't actually clear a strict 2σ bar when computed over all
four points by hand — the outlier's own presence inflates the mean and stddev enough
that its deviation (~56) falls short of the threshold (~65 population / ~75 sample).
This is implemented per the literal formula in the spec rather than adjusted to force
that particular example to fire; see the comment in `anomalies.ts` for the numbers.

Both bonus endpoints reuse the same time-range validation as `/summary`, and treat an
empty result for a *known* user as a normal `200` (with `items: []` in the paginated
envelope) rather than a `404` — a user having zero sessions or zero anomalies in a
given window is a legitimate answer, not an error, which is a deliberate difference
from `/summary`'s "404 on nothing to show" behavior for a single-object response.
`/anomalies` was deliberately given the same `{ items, page, page_size, total,
total_pages }` envelope as `/sessions` (see `docs/roadmap.md` Phase 3) for
consistency between the two sibling list endpoints, even though only `/sessions`'s
result set strictly needed pagination.

## AI tool usage

This was built end-to-end with **Claude Code** (Anthropic's CLI coding agent), used
for:
- Fetching and statistically analyzing the real CSV (row counts, action/metadata-key
  distributions, timestamp range, and — critically — discovering the unquoted-JSON
  comma hazard by writing and running a small Python analysis script against the
  actual file before writing any parser code).
- Drafting the backend (CSV parser/validator, in-memory indexed store, Express
  routes, query-param validation) and frontend (React forms, API client, Chart.js
  bar chart) from the spec's requirements.
- Verification: ran `tsc --noEmit` on both packages, exercised every endpoint with
  `curl` against the real CSV (valid/missing/nonexistent user, bad timestamps,
  `start_time > end_time`), checked the sessions/anomalies math against the spec's
  own worked numbers with a standalone script, and drove the running app in a
  headless Chromium (Playwright) to screenshot all four forms — including error
  states — before calling any of it done.
- Bonus endpoints (`/sessions`, `/anomalies`) and their frontend forms were
  implemented after the core, using the same patterns (store access, validation,
  error shape) established there.

## Notes

- Bonus questions (session detection, anomaly detection) are implemented — backend
  endpoints, frontend forms, and both are verified against the spec's own worked
  examples (see "Bonus: sessions & anomaly detection" above for the one place the
  spec's numbers didn't hold up under a literal reading).
