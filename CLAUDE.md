# User Activity Log Analytics Platform

Originally built as a timed 2-hour technical test (Plank AI Accelerator). That build
is complete and shipped — its task list is frozen in [docs/tasks-mvp.md](docs/tasks-mvp.md).

**The project is now in a second phase:** hardening the MVP into a well-architected,
tested, multi-screen application. Current roadmap: [docs/roadmap.md](docs/roadmap.md).

The 2-hour origin is not something to hide — it's part of the story. But its
constraints no longer apply. Where the old docs said "don't gold-plate, the clock is
running," the opposite now holds: extraction, testing, and clean seams are the point
of the work.

## 1. What this system is

A full-stack app answering analytics questions over a user-activity event log.

- **Backend** (Node.js + TypeScript + Express): fetches `activities.csv` from a CDN
  URL on startup and via `POST /load`, parses it into an in-memory store, exposes:
  - `GET /summary?user_id=&start_time=&end_time=` — per-user stats.
  - `GET /action_trends?start_time=&end_time=` — top `(user_id, action)` pairs.
  - `GET /sessions?user_id=&start_time=&end_time=` — sessions (gap ≤ 30 min).
  - `GET /anomalies?user_id=&start_time=&end_time=` — durations >2σ from the mean.
- **Frontend** (React + TypeScript + Vite): one screen per feature, sharing a filter
  component and a query hook. Chart.js for trends.
- **No database.** Everything lives in memory for the process lifetime.

`backend/` and `frontend/` stay separate packages. Do not merge them.

## 2. How things run

- Backend: `cd backend && npm run dev` — starts on `http://localhost:4000`, fetches
  the CSV at boot. `PORT` env var overrides the port.
- Frontend: `cd frontend && npm run dev` — starts on `http://localhost:5173`, proxies
  API paths to the backend (see `frontend/vite.config.ts`).
- Data flow: browser → Vite dev server proxy → backend REST API → in-memory store.
  No CSV parsing in the browser.
- The backend fetches the *actual* CDN CSV at startup. A local copy is fine for
  offline testing, but must not become the primary path.

> **Keep this section and `frontend/vite.config.ts` in sync.** Every endpoint the
> frontend calls by relative path needs a proxy entry. A missing entry only surfaces
> as a 404 at runtime, on a fresh clone.

## 3. Patterns to follow

- **TypeScript strict mode** on both sides. Type the parsed CSV row, the metadata
  shape, and every API response explicitly — no `any` on data that flows into a
  query, and no `as` used to silence a type error.
- **Parse once, query many.** CSV parsing happens once per `/load`, producing
  in-memory structures shaped for the read patterns the endpoints need:
  - `Map<user_id, events[]>`, each user's events sorted ascending by timestamp, for
    `O(1)` lookup in `/summary`, `/sessions`, `/anomalies`.
  - Time filtering narrows an already-indexed slice via binary search — never a full
    re-scan or re-parse per request.
- **CSV parsing must not assume comma-safe fields.** See
  [docs/data-source.md](docs/data-source.md) — the `metadata` column is unquoted JSON
  containing commas. Split on the first 3 commas only. Never hand the raw line to
  `split(',')` or to a CSV library configured for strict RFC 4180 quoting.
- **Validate at the boundary.** CSV rows are validated once during `/load` (bad row →
  skip + count, don't crash the load unless the file is structurally broken). Query
  params are validated per-request before touching the store. These two layers stay
  separate — route-level validation must not leak into the parser, and the parser's
  helpers must not be imported by the HTTP layer. Shared primitives (e.g. ISO
  timestamp validation) live in `shared/`.
- **Errors are JSON + correct status codes.** 400 for bad/missing params, 404 for a
  `user_id` with no data, 500 only for genuine server failure. Always `{ error: string }`.
  Route handlers throw `HttpError`; one central error handler converts it.
- **No new global state.** Dependencies are constructed at the composition root and
  passed as parameters. No module-level singletons — they make tests share state and
  block fake injection.
- **Don't duplicate logic.** If the same shape appears in two handlers or two
  components, extract it — a middleware on the backend, a hook or shared component on
  the frontend. This rule exists because the MVP shipped with `validate()` copied
  verbatim across three form components and the same four-step preamble copied across
  three route handlers. Do not recreate that.
- **Comment the *why*, not the *what*.** The existing comments on the store's index
  structure, the CSV splitter, and the stddev choice are the standard — they explain
  a decision a reader would otherwise question. Never narrate what the code does.
- **Frontend stays dumb.** No aggregation or filtering in React. The backend owns all
  computation; the frontend submits filters, renders results, renders errors.

## 4. Domain invariants

These are decided, verified, and must not be changed as a side effect of refactoring.
Changing any of them is a deliberate task with a doc update, never a cleanup.

- **`/summary` 404s on an empty range; `/sessions` and `/anomalies` return `200 []`.**
  This asymmetry is intentional: `/summary` returns a single object with no meaningful
  empty shape, while an empty list is a correct answer for a list endpoint. A known
  `user_id` with no data *at all* is 404 on all three.
- **`start_time` after `end_time` → 400**, not an empty result.
- **Session boundary is an inclusive `<= 30 min` gap**, matching the spec's worked
  example: 12:00 → 12:25 is one session; a 13:00 action after that starts a new one.
- **Ties are broken by first-seen order**, relying on `Map` insertion order and
  `Array.prototype.sort` stability — never on incidental key iteration order.
- **Anomalies use *population* stddev**, so 0/1-sample groups yield `stdDev = 0` and
  produce no anomalies without a special-case branch. The spec's own worked example
  doesn't clear a strict 2σ bar under a literal reading; the literal formula wins.
  See the comment in `backend/src/anomalies.ts`.
- **A failed `/load` must leave the previous good data intact.** The store is swapped
  in only on success.
- **Endpoints before any successful load return 503**, not a crash or an empty result.
- **All timestamps are UTC.** The source data is UTC-native (`Z`-suffixed, no offsets
  — verified across all rows). The API accepts and returns UTC ISO 8601. The frontend
  must not convert `datetime-local` input through `new Date()`, which reinterprets it
  as browser-local time and silently shifts the filter window.

## 5. How we work

- **Work in roadmap phases, one at a time.** Do not start a later phase's work while
  in an earlier one, and do not combine phases in a single change — a refactor and its
  tests landing in the same diff means the tests were written against the new code
  rather than proving behavior was preserved.
- **Present a plan and wait for approval before editing files.**
- **Behavior-preserving phases must preserve behavior exactly.** When a phase says
  contracts don't change, responses stay byte-identical. Say so explicitly if you
  believe a contract needs to change, and wait.
- **Each phase ends green:** `tsc --noEmit` clean on both packages, tests passing
  (once they exist), app runs.
- Keep [docs/roadmap.md](docs/roadmap.md) checked off as work completes.
- `docs/data-source.md` is frozen analysis of the real CSV. Read it; don't edit it.
- `docs/tasks-mvp.md` is a historical record of the original build. Don't edit it.
- Update `README.md` when setup, commands, or API contracts change — not at the end.