# Roadmap — MVP to production-shaped

The original 2-hour build is complete and frozen in [tasks-mvp.md](tasks-mvp.md).
This is the hardening roadmap: seams, tests, one screen per feature, pagination.

**Rules:** one phase at a time, plan before editing, commit at the end of each phase,
`tsc --noEmit` clean before moving on. Phases 1–2 change no API contract at all.

---

## Phase 1 — Backend seams (no contract changes)

Every endpoint response stays byte-identical. This phase exists to make Phase 2
possible: you can't integration-test an app that calls `listen()` at import time.

- [x] Split `server.ts` into `app.ts` exporting `createApp(store)` (routes + error
      handler, no `listen`) and `server.ts` (bootstrap only: construct store, create
      app, listen, trigger initial load).
- [x] Remove the `activityStore` module singleton. Export the `ActivityStore` class;
      instantiate at the composition root and pass it in.
- [x] Extract the preamble duplicated across `/summary`, `/sessions`, `/anomalies`
      into one middleware: `requireLoaded` → `parseRequiredUserId` → `parseTimeRange`
      → 404 if `!hasUser` → attach the in-range events.
      **`/summary` keeps its additional 404 on an empty range — that one is specific
      to it** (see CLAUDE.md §4).
- [x] Move `isValidIsoTimestamp` out of `csvParser.ts` into `shared/time.ts`.
      `validation.ts` must no longer import from the CSV parser.
- [x] Fix: `parseMetadata` accepts negative `duration`. `docs/data-source.md` says
      not to assume non-negative. Reject `duration < 0` as an invalid row — a negative
      duration corrupts `avg_duration` and fabricates anomalies.

**Done when:** `curl` output for all four endpoints matches pre-refactor output
exactly (valid user, unknown user, bad timestamp, inverted range), and no module
exports a mutable instance.

---

## Phase 2 — Tests

The highest-value phase. The MVP was verified by hand (curl + Playwright); nothing
is automated. Everything after this phase is safer because of it.

- [x] Test runner wired up on both packages (vitest), `npm test` in each.
      Frontend has zero test files today (no testable unit exists before Phase
      4); `vitest.config.ts` sets `passWithNoTests` so `npm test` is green
      rather than red-by-default until then.
- [x] Unit: `csvParser` — the unquoted-JSON line, wrong header aborts, bad row is
      skipped and counted, empty body, negative duration rejected.
- [x] Unit: `computeSessions` — the spec's worked example, the inclusive 30-min
      boundary (exactly 30 min = same session, 30 min + 1s = split), single event,
      empty input.
- [x] Unit: `computeAnomalies` — identical durations produce none, single-sample
      group produces none, a clear outlier is flagged, grouping is per-action.
- [x] Unit: `computeUserSummary` / `computeActionTrends` — tie-break determinism.
- [x] Unit: `store` — binary-search range slicing at boundaries (inclusive start,
      inclusive end); failed-reload-keeps-old-data actually lives in
      `loader.test.ts` (mocking `fetchActivitiesCsv`), since `replaceData` itself
      can't fail — see that file's comment.
- [x] Integration (supertest on `createApp`): each endpoint's 200 / 400 / 404 / 503
      paths, including the `/summary` vs `/sessions` empty-range asymmetry.
      `/load`'s success path is not integration-tested — it requires a real
      network fetch, which this phase forbids tests from doing.
- [x] Fixture CSV committed (`backend/test/fixtures/activities.csv`) — tests must
      not hit the CDN.

**Done when:** every invariant in CLAUDE.md §4 has a test that fails if you break it.

---

## Phase 3 — API contracts

First phase that changes responses. Update `README.md` in the same commit.

- [x] `GET /users` — available user IDs with event counts. Powers the frontend
      autocomplete; removes "guess a number" as the entry point to every screen.
- [x] `GET /health` — load status, row counts, skipped-row diagnostics. Uses
      `getLastLoadResult()`, currently dead code.
- [x] `/action_trends?limit=` — default 3, validated, capped. Chart title stops
      being hardcoded to "Top 3".
- [x] `/sessions` paginated: `?page=&page_size=` returning
      `{ items, page, page_size, total, total_pages }`.
      **Note:** sessions are derived from contiguous event runs, so pagination happens
      after computing all sessions for the range — you cannot paginate at the event
      level. Fine at this data size.
- [x] **Decided:** `/anomalies` gets the same paginated envelope as `/sessions`, for
      consistency between sibling list endpoints — worth more than the smaller diff
      of leaving `/anomalies` as a bare array. Recorded as an invariant in
      CLAUDE.md §4.
- [x] Frontend consumers (`SessionsForm`, `AnomaliesForm`, `api.ts`, `types.ts`)
      updated to read the new `items` envelope — part of this contract change, not
      deferred to Phase 4 (which is unrelated: `useQuery`, `<ActivityFilters/>`, the
      timezone bug). No pagination UI yet — that's Phase 6.

**Done when:** Phase 2 tests updated and passing, README's API section matches.

---

## Phase 4 — Frontend seams

Mirrors Phase 1 on the other side. No routing yet.

- [x] Remove `passWithNoTests` from `frontend/vitest.config.ts` once the first
      hook/component test exists (see Phase 2) — an empty suite should stop
      being an acceptable green. Retired once `useQuery.test.ts` and
      `validation.test.ts` landed.
- [x] `useQuery(fetcher)` hook — owns `loading` / `error` / `data` / `run()`, with an
      `AbortController` so a superseded request can't overwrite a newer result.
      Also gained a `reset()` (not originally scoped) so a failed re-validation
      can clear a stale result without reopening the same race — see
      `frontend/src/hooks/useQuery.ts`.
- [x] `<ActivityFilters/>` — the userId + start + end block, with the validation that
      is currently copy-pasted verbatim across three components. Reused by
      `ActionTrendsForm` too (`requireUserId={false}`), removing what would
      otherwise be a fourth near-duplicate.
- [x] API client takes an `AbortSignal`; drop the four near-identical query-string
      builders into one helper.
- [x] **Fix the timezone bug.** Stop passing `datetime-local` values through
      `new Date().toISOString()` — that reinterprets them as browser-local and shifts
      the window (in UTC−3, a 05:21 filter is sent as 08:21Z). Treat input as UTC:
      append `:00Z`. Source data is UTC-native; the UI stays UTC end to end.
      Verified live: submitting `05:21` sends `start_time=2024-01-01T05:21:00Z`.
- [x] Shared formatters for timestamps and durations. Stop printing raw ISO strings
      and bare `123s` in tables.
- [x] Replace `key={i}` with a stable key — required before pagination.
      `Sessions`/`Anomalies` now key on `${start}|${end}` / `${timestamp}|${action}`;
      confirmed `ActionTrendsChart` has no JSX-keyed list to fix (its two `.map()`
      calls build Chart.js's `labels`/`data` arrays, not React elements).

**Done when:** the three user-scoped screens contain no duplicated validation, state,
or submit logic, and a fast double-submit can't render a stale response.

---

## Phase 5 — Routing

- [x] `react-router`, one route per feature: `/summary`, `/trends`, `/sessions`,
      `/anomalies`. Redirect `/` to `/summary`. Unknown paths redirect too.
- [x] Shared layout: header, nav with active state (`frontend/src/components/Layout.tsx`).
- [x] Filters live in the URL (`?user_id=74&start_time=...`) so a view is
      shareable, reloadable, and the back button works. `useUrlFilters` hook
      (`frontend/src/hooks/useUrlFilters.ts`) is the seam: `useSearchParams()`
      is the single source of truth, a `useEffect` on the params auto-fetches
      (paste/reload/back-forward all go through it), and submit just writes
      to the URL rather than calling the fetch directly.
- [x] Filters persist across navigation — switching from Summary to Sessions for the
      same user shouldn't clear the form. `Layout`'s nav links carry the current
      `location.search` forward, so the URL itself carries the filters across screens.
- [x] **Found during verification, fixed in this phase:** `/summary`, `/sessions`,
      `/anomalies` are now both proxied API path prefixes *and* client-side routes.
      A hard navigation/fresh tab to e.g. `/sessions?user_id=1` was getting proxied
      straight to the backend's JSON instead of serving the SPA. Fixed in
      `frontend/vite.config.ts` with a `bypass` that lets real page navigations
      (`Accept: text/html`) fall through to `index.html` while the app's own
      `fetch()` calls (no such header) still proxy to the backend.

**Done when:** pasting a URL reproduces the exact view, with no state in `App`.

---

## Phase 6 — Pagination UI

- [x] Page controls on Sessions, reading/writing `?page=` in the URL. Shared
      `<Pagination/>` (`frontend/src/components/Pagination.tsx`) also used by
      Anomalies, since both page the same `Page<T>` envelope.
- [x] Page size selector, also in the URL (`?page_size=`, options 10/20/50/100,
      default 20 to match the backend's `DEFAULT_PAGE_SIZE`).
- [x] Changing filters resets to page 1. `useUrlFilters.handleSubmit` drops
      `page` from the next URL (defaults to 1) while carrying `page_size`
      forward.
- [x] Out-of-range page handled (deep link to page 99 of a 3-page result):
      `useUrlFilters` clamps the URL's `page` down to the response's
      `total_pages` once it's known, which re-triggers a fetch for the
      corrected page. Verified live: `/sessions?user_id=3&page=99` lands on
      `page=2` of 2.
- [x] Loading state doesn't collapse the table height on page change.
      `useQuery.run()` gained an opt-in `keepDataOnLoad` option — Sessions and
      Anomalies pass `{ paginated: true }` to `useUrlFilters`, which keeps the
      previous page's rows on screen while the next page loads instead of
      nulling `data` immediately. Summary/Trends are unaffected (opt-in, off
      by default).

---

## Phase 7 — Polish

- [x] CSS restructured — design tokens, scoped styles. Element selectors (`button`,
      `input`, `table`) stop being global. Follows `docs/design.md`: palette,
      type scale, and 4px spacing scale as `:root` custom properties; filters
      move into a persistent left rail (`ScreenLayout`) instead of living
      inside each result card. Fixed alongside it: `formatDuration`'s
      `seconds % 60` float leak (`2m 35.08000000000001s`), rounded to 2
      decimals with a carry into minutes.
- [x] Responsive layout. The MVP explicitly skipped this (spec didn't require it);
      it's now worth doing. Below 900px the rail collapses to a `<details>`
      disclosure above the results, open by default until a result exists.
- [x] Session timeline (design doc's "Signature" section) — a horizontal
      strip above the Sessions table, each session a bar positioned at its
      real start with width proportional to its own span (`end - start`).
      `/sessions` gained `range_start`/`range_end` on the envelope (first
      session's start, last session's end across the *full*, pre-pagination
      list — derived for free since `computeSessions` already returns
      sessions in chronological order) so the axis stays fixed as you
      paginate, instead of rescaling per page. Bars for sessions outside the
      current page are not drawn — the envelope only carries the two range
      scalars, not every session's position, and adding that was judged not
      worth the complexity. Anomalies' duration-distribution strip is a
      separate, still-open item.
- [x] User autocomplete backed by `GET /users`. Native `<input list=…>` +
      `<datalist>` (`useUsers` hook, fetched once per screen mount, only when
      `requireUserId` — Action Trends skips it). Fails silently: the field
      still works as a plain number input if `/users` errors, since the
      autocomplete is a convenience, not the screen's real query. `UserCount`
      added to `shared/types.ts` so the backend's `/users` response is typed
      instead of built as an inline object literal (JSON unchanged).
- [x] Real empty and error states per screen. Sessions/Anomalies/Trends empty
      copy landed in Phase 7a; this phase covers the error side —
      `validateFilters` now says "User" instead of "User ID" (matches the
      renamed label), and `api.ts`'s `getJson` gives directive copy for the
      two generic failure paths instead of a raw browser message or a bare
      status code: a network failure ("Couldn't reach the server. Check your
      connection and try again.") and a response with no error body ("The
      server had a problem. Try again."). Backend error messages (e.g. "No
      data for user X") already named the problem and were left as-is.
- [x] Accessibility: `role="alert"` added to `ActivityFilters`' inline
      validation error (the four screens' query-error banners already had it
      from Phase 7a). `aria-busy={loading}` on the submit button. Labels
      switched from implicit wrapping to explicit `htmlFor`/`id` pairs — also
      fixes a latent bug where the new `<datalist>`'s `<option>` text would
      have been picked up into the "User" label's accessible name if left
      nested inside a wrapping `<label>`. Visible focus extended to the nav
      links and the pagination page-size `<select>`, which were previously
      falling back to the browser's default (non-themed) outline.
- [x] Shared types between packages — stop hand-mirroring `types.ts`. New
      `shared/` package (`activity-analytics-shared-types`, file: dependency
      in both `backend/package.json` and `frontend/package.json`) exports
      `UserSummary`, `TrendPair`, `SessionSummary`, `AnomalyEvent`, `Page<T>`.
      Backend builds these shapes (`analytics.ts`, `pagination.ts`,
      `sessions.ts`, `anomalies.ts` now import the interfaces instead of
      declaring them); `frontend/src/types.ts` re-exports the same types
      instead of hand-mirroring them.
- [x] README: evolution section (2h MVP → hardening phases), screenshots, test
      commands, `PORT` documented. Closed in Phase 8 (see below) alongside the
      README's API section rewrite, since both touched the same file in the same
      pass. No lint command to document — CI/lint setup stays explicitly out of
      scope (see Phase 8's own out-of-scope note).

---

## Phase 8 — Product shape

Full plan and reasoning:
[`docs/superpowers/plans/2026-08-10-phase-8-product-shape.md`](superpowers/plans/2026-08-10-phase-8-product-shape.md) /
[`docs/superpowers/specs/2026-08-10-overview-product-design.md`](superpowers/specs/2026-08-10-overview-product-design.md).
Two problems drove it, both observed in the running app: the user picker was an
unstyled OS `<datalist>` popup that ignored the palette and couldn't be searched
sensibly, and nothing told the operator where the data actually was, so an
impossible date range silently returned an empty result that read as a bug.

**Step 1 — Backend (additive):**
- [x] `GET /overview?start_time=&end_time=&bucket=` — dataset totals, a bucketed
      activity series, top actions, top users. `computeOverview()` reuses
      `store.getAllUsersEventsInRange()`; no new store index, no change to the load
      path.
- [x] UTC bucket boundary math (`bucketStartMs`/`nextBucketMs`) — day to midnight,
      week to the preceding Monday, month to the 1st by calendar increment. Empty
      buckets are emitted, not skipped (CLAUDE.md §4).
- [x] `/health` gains `dataset_start`/`dataset_end` — the dataset's own bounds,
      filter-independent, computed once in `replaceData` rather than per request.
- [x] `/users` gains a per-user `activity` sparkline series (`USER_SPARKLINE_BUCKETS
      = 24`), spanning the dataset's bounds rather than the current filter.

**Step 2 — Identity foundations (applies to the pre-existing screens first, so value
lands before any restructure):**
- [x] Self-hosted `--font-data` (JetBrains Mono via `@fontsource`, no CDN) applied to
      every numeric surface.
- [x] Session-bars `Wordmark` component beside the header title.
- [x] Result-region fade transition, `Skeleton` loading rows, visible focus rings —
      the parts of Phase 7's design doc that were specified but never built.

**Step 3 — Routing + filter bar + Overview screen (still additive; old screens
remained reachable underneath until Step 4):**
- [x] `TopFilterBar` — range chip, `Custom…` popover (Radix) with date inputs
      clamped to `/health`'s dataset bounds (the actual fix for the
      impossible-window problem — it makes the bad query untypeable), and a bucket
      segmented control.
- [x] `ActivityChart` — Chart.js line, single hue read from `--accent`, no vertical
      gridlines, no point markers at rest, peak labelled once (not every point).
- [x] Overview screen (`/`) — KPI tiles, the activity chart, top actions and
      most-active users with `<Link>` drill-downs into `/users?user_id=`.
- [x] Trends chart restyled to the same mark spec; drill-down list added beneath it.
      Real `<Link>`s, not canvas click handlers — keeps Phase 7's keyboard/focus
      accessibility work intact.

**Step 4 — Users master–detail (the one destructive step: deleted three components
and rebuilt their content inside a new screen):**
- [x] `UserList` — a filtered `role="listbox"` over `GET /users`, each row showing
      the ID, a `Sparkline`, and the count. Replaces the `<datalist>` autocomplete
      entirely (no combobox needed — the list is always visible, so it's a simpler
      pattern than the popup it replaced).
- [x] `UserDetail` — a summary tile row plus Radix `Tabs` for Sessions/Anomalies,
      each tab's panel owning its own `useUrlFilters` call against its own endpoint.
      Tab triggers carry live counts; switching tabs resets `page` to 1 in the same
      navigation.
- [x] `UsersScreen` assembles list + detail; `/summary`, `/sessions`, `/anomalies`
      become redirects into `/users` that preserve the query string (and set `?tab=`
      where relevant), so previously shared links still resolve.
- [x] `vite.config.ts` — `/users` is now both an API prefix and a client route, the
      same collision `/summary`/`/sessions`/`/anomalies` hit in Phase 5; given the
      same `bypass` treatment.
- [x] `UserSummaryForm`, `SessionsForm`, `AnomaliesForm`, `ActivityFilters`, and the
      now-unused `ScreenLayout` (the old rail wrapper) deleted. `ActionTrendsForm`
      migrated to `TopFilterBar` in the same step — not originally scoped to this
      task, but required once `ActivityFilters` was gone; the plan's "no dangling
      references" check is what surfaced it.
- [x] First test infrastructure for rendered components (`@testing-library/jest-dom`,
      a shared `test-setup.ts` with `afterEach(cleanup)`) — `UserList.test.tsx` was
      the first test in either package to render a component rather than a hook.

**Not built in Phase 8** (see `docs/design.md`'s amendments section): the anomalies
duration-distribution strip designed in the spec's §4.4 but not implemented.

**Known simplifications against the original plan**, made for scope/robustness, not
laziness — each is small and reversible if it matters later:
- The activity chart's peak is a text caption above the chart ("Peak: N on <date>")
  rather than a label absolutely positioned over the peak point — same information,
  robust to resize, no pixel-position math against the canvas.
- Both Sessions and Anomalies tab panels are mounted simultaneously (Radix
  `forceMount` + `hidden`) rather than lazily, so both tab triggers can show a count
  before the user has switched tabs once.
- The Users screen collapses to a single stacked column below 900px rather than the
  `<details>` disclosure pattern the older screens used — functional, simpler, no
  horizontal scroll, but not the exact same collapse interaction.

**Done when:** every invariant this phase added lives in CLAUDE.md §4, `tsc --noEmit`
is clean and tests pass on both packages, and the app runs against the real CDN CSV.

---

## Deliberately out of scope

Named so they don't get half-built by accident: no database, no auth, no real-time
updates, no CSV upload from the browser, no server-side rendering.