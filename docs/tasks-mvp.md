# Implementation Tasks

Ordered to match the spec's own time budget: backend core → frontend core → polish →
bonus (if time remains) → README. Check off as completed.

## 0. Setup
- [x] `backend/` — Node.js + TypeScript project (`package.json`, `tsconfig.json`,
      Express + `cors`, dev script via `tsx`/`ts-node`).
- [x] `frontend/` — React + TypeScript via Vite, Chart.js (`react-chartjs-2`).
- [x] Root `.gitignore` (`node_modules`, `dist`, `build`).

## 1. Backend — data loading
- [x] CSV fetch module: `GET` the CDN URL, throw a typed error on network failure /
      non-2xx.
- [x] CSV line parser: split each line on first 3 commas only (see
      [data-source.md](data-source.md) — metadata JSON is unquoted and comma-bearing).
      Do not use a naive full-line `split(',')` or an off-the-shelf CSV lib without
      confirming it survives this.
- [x] Row validation: `user_id` → integer, `timestamp` → valid ISO 8601, `action` →
      non-empty string, `metadata` → valid JSON object. Invalid rows are skipped
      (collect a count/list for diagnostics), not fatal — unless the file is
      structurally broken (wrong header / unparseable as a whole).
- [x] Typed row model + typed `metadata` shape (base: `page`, `duration`; action-
      specific: `query` on `search`, `file_type` on `download`, `file_size` on
      `upload` — read defensively, don't assume presence).
- [x] In-memory store, built fresh on each successful load:
      - Map `user_id → events[]`, each user's events sorted by timestamp ascending.
      - Structure supporting `(user_id, action)` aggregation for trends without a
        full re-scan per request.
      - Loading is idempotent/replaceable; a failed reload must not clobber existing
        good data.
- [x] `POST /load` — triggers fetch + parse + rebuild store; also run once at server
      startup. Returns row count / success status.

## 2. Backend — core endpoints
- [x] `GET /summary?user_id=&start_time=&end_time=`
      - 400 if `user_id` missing/non-numeric, or `start_time`/`end_time` present but
        invalid, or `start_time > end_time`.
      - 404 if `user_id` has no matching rows (in range, or at all — decide and
        document which).
      - Response: `{ user_id, total_actions, most_frequent_action, avg_duration,
        most_frequent_page }`, tie-breaks deterministic.
- [x] `GET /action_trends?start_time=&end_time=`
      - Both params optional per spec's endpoint signature — confirm behavior with no
        params (full dataset) vs partial range.
      - Response: top 3 `[{ user_id, action, count }]` by frequency, deterministic
        tie-break.
- [x] Shared query-param validation helpers (parse/validate ISO timestamps once, reuse
      across endpoints).
- [x] Consistent error response shape (`{ error: string }`) across all endpoints.
- [x] Manual test pass against the real CDN CSV (not just the spec's 4-row sample) —
      confirm `/summary` and `/action_trends` return sane results and edge cases
      (missing user, bad dates) return correct status codes.

## 3. Frontend — core UI
- [x] API client module (`fetch` wrapper) for `/summary` and `/action_trends`, typed
      responses matching backend contracts exactly.
- [x] User Summary form: `user_id` (required), `start_time`/`end_time` (optional).
      Client-side validation before submit; disable submit button while the request is
      in flight; render result fields or an error message (e.g. "No data for user").
- [x] Action Trends form: `start_time`/`end_time`. Same validation/disable/error
      pattern. Renders a bar chart (Chart.js) of the top-3 `(user_id, action)` pairs.
- [x] Basic CSS: readable fonts, styled buttons/forms, legible chart — no
      responsiveness work required per spec.

Verified in a real headless-Chromium run: summary populates correctly for a valid
user, shows "No data for user 99999" for a nonexistent one, and the trends form
renders a working Chart.js bar chart matching the API response.

## 4. Bonus (only after core is solid)
- [x] Backend `GET /sessions?user_id=&start_time=&end_time=` — group a user's sorted
      events into sessions where consecutive-action gap ≤ 30 min; each session reports
      start, end, action count, total duration. Verified against the spec's worked
      example (12:00 login 30s + 12:25 click 45s → one session, 75s total) with a
      standalone check script — output matched exactly.
- [x] Backend `GET /anomalies?user_id=&start_time=&end_time=` — per `(user_id,
      action)` pair, flag durations >2 stddev (population stddev) from that pair's
      mean. 0/1-sample groups naturally yield zero anomalies (stdDev is 0, nothing
      exceeds a >0 threshold) with no special-case branch needed. Note: the spec's
      own worked example ([30,20,25,100] → flag 100) does not actually clear a strict
      2σ bar when computed by hand (deviation ~56 vs. threshold ~65–75) — implemented
      per the literal formula rather than tuned to match that example's numbers; see
      comment in `backend/src/anomalies.ts`.
- [x] Frontend: Sessions form + table display.
- [x] Frontend: Anomalies form + table display.
- [x] List-endpoint semantics decided: `/sessions` and `/anomalies` return `200 []`
      for a known user with no results in range (unlike `/summary`'s 404), since an
      empty list is a normal successful answer for these; still `404` for a user_id
      with no data at all. Verified against the live CSV + browser smoke test.

## 5. Wrap-up
- [x] `README.md`: setup/run instructions for both `backend/` and `frontend/`, an
      explanation of the in-memory data structures and why they're shaped that way,
      bonus-endpoint notes if implemented, and an honest AI-tool-usage section.
- [ ] Optional `notes.txt` for anything that doesn't fit the README.
- [ ] Before zipping for submission: remove `node_modules`/build output from both
      packages, keep source only.
