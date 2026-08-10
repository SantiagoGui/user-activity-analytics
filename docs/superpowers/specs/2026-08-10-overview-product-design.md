# Phase 8 — From query tool to product

**Status:** design approved, not yet implemented.
**Goal:** the app currently opens on an empty form and asks for a user ID the
operator has no way of knowing. This phase makes it open with an answer, and
makes choosing a user a matter of picking from a list rather than guessing an
integer.

Two problems drive every decision below, both observed in the running app:

1. **The user picker is an OS popup.** `<input list>` + `<datalist>` renders 125
   entries in a system panel that ignores the palette, overflows the viewport,
   and covers the results. It cannot be styled, ranked, or truncated. Compounded
   by `type="number"`, which puts spinner arrows next to the dropdown caret —
   two conflicting affordances on a field whose real job is search.
2. **Nothing communicates where the data is.** The dataset spans
   `2024-01-07` → `2024-12-27`. The UI accepts any range, including windows that
   cannot contain data, then reports an empty result — which reads as a bug.

---

## 1. Information architecture

Four screens become three.

| Route | Screen | Notes |
| --- | --- | --- |
| `/` | **Overview** | No input required. Dataset-level answer. |
| `/users?user_id=22` | **Users** | Searchable list + detail. Absorbs summary, sessions, anomalies. |
| `/trends` | **Trends** | The one genuinely cross-user view. Unchanged in substance. |

`/summary`, `/sessions` and `/anomalies` stop being destinations. They were three
screens asking for the same user and rendering different facets of them — the
duplication was the signal that the IA was wrong. They become a tile row and two
tabs inside the user detail.

Old routes redirect, preserving the query string, so previously shared links
still resolve:

- `/summary?user_id=22` → `/users?user_id=22`
- `/sessions?user_id=22&page=2` → `/users?user_id=22&tab=sessions&page=2`
- `/anomalies?user_id=22` → `/users?user_id=22&tab=anomalies`
- `*` → `/`

**The selected user stays a query param (`?user_id=`), not a path segment.**
`useUrlFilters` and its tests are built around query params; a path segment would
mean real surgery on the one hook every screen depends on, for a cosmetic gain.

---

## 2. Backend

### 2.1 `GET /overview`

The first endpoint that describes the dataset rather than interrogating a slice
of it. No `user_id`.

```
GET /overview?start_time=&end_time=&bucket=day|week|month
```

```jsonc
{
  "total_events": 3063,
  "total_users": 125,
  "distinct_actions": 6,
  "range_start": "2024-01-07T04:10:14Z",   // null when the range is empty
  "range_end":   "2024-12-27T05:34:13Z",
  "bucket": "week",
  "activity":    [{ "bucket_start": "2024-01-01T00:00:00Z", "count": 12 }],
  "top_actions": [{ "action": "login", "count": 531 }],
  "top_users":   [{ "user_id": 3, "count": 40 }]
}
```

Status codes:

- `503` before any successful load (existing `requireLoaded`).
- `400` on an invalid timestamp, an inverted range, or an unrecognised bucket.
- `200` otherwise — **including an empty range**, which returns zeros, an empty
  `activity` array, and `null` range bounds.

`computeOverview()` consumes `store.getAllUsersEventsInRange()`, which already
exists and already does the per-user binary search. **No new store index, no
change to the load path.**

### 2.2 Bucketing rules

- **Boundaries are UTC.** Day floors to UTC midnight, week to the preceding UTC
  Monday, month to the 1st at UTC midnight. Consistent with CLAUDE.md §4's "all
  timestamps are UTC".
- **Empty buckets are emitted, not skipped.** A series that omits zero-weeks
  redraws the shape of the data and misrepresents it. The series runs
  continuously from the bucket containing `range_start` to the bucket containing
  `range_end`.
- **Month stepping increments the calendar month** (`Date.UTC(y, m + 1, 1)`),
  not a fixed millisecond delta. Days-per-month varies; UTC means no DST to
  worry about.
- Series length is bounded by the data, not by user input: the series only spans
  first-to-last event *within the range*, so the daily worst case over this
  dataset is ~355 points.

### 2.3 `top_actions` / `top_users`

Top 5 of each (`OVERVIEW_TOP_N` in `config.ts`). Ties break by first-seen order,
matching CLAUDE.md §4 and `computeActionTrends` — stable sort over a `Map` built
in the store's user-iteration order.

### 2.4 Dataset bounds move onto `/health`

The frontend needs the **full dataset span**, unaffected by the current filter,
to clamp the date inputs. That cannot come from `/overview`'s `range_start` —
those describe the filtered slice and shrink as you filter.

So `/health` gains two fields:

```jsonc
{
  "loaded": true,
  "total_lines": 3063, "rows_loaded": 3063, "rows_skipped": 0, "skipped_reasons": [],
  "dataset_start": "2024-01-07T04:10:14Z",   // null before load / empty store
  "dataset_end":   "2024-12-27T05:34:13Z"
}
```

This is the right home: `/health` already describes system state and is already
exempt from `requireLoaded`. Putting bounds on both endpoints would create two
sources of truth for the same fact.

`ActivityStore` computes the bounds once inside `replaceData` and exposes
`getDatasetBounds()` — O(1) reads, no scan per request.

### 2.5 `GET /users` gains a sparkline series

To let the user list show each user's activity *shape* rather than just a count
(§4.5), `/users` returns a small bucketed series per user:

```jsonc
[{ "user_id": 3, "count": 40, "activity": [0, 2, 1, 5, 0, 3, ...] }]
```

Fixed-length series (`USER_SPARKLINE_BUCKETS = 24`) spanning the **dataset**
bounds, not the current filter — the list is a navigation aid, so a user's shape
should stay recognisable as you change the range. Counts are raw, not normalised;
the frontend scales each sparkline to its own maximum.

24 buckets over 125 users is 3,000 integers — a few KB, computed from the same
sorted per-user arrays the store already holds. Sized to be legible at ~90px
wide, not to be a chart.

### 2.6 Files touched

| File | Change |
| --- | --- |
| `backend/src/overview.ts` | new — `computeOverview(usersEvents, bucket)`, pure |
| `backend/src/overview.test.ts` | new |
| `backend/src/validation.ts` | `parseBucket()` alongside `parseLimit`/`parsePagination` |
| `backend/src/config.ts` | `DEFAULT_BUCKET = 'week'`, `OVERVIEW_TOP_N = 5` |
| `backend/src/store.ts` | dataset bounds computed in `replaceData`, `getDatasetBounds()`; `listUserCounts()` gains the sparkline series |
| `backend/src/app.ts` | `/overview` route; `/health` gains bounds |
| `shared/types.ts` | `BucketSize`, `ActivityBucket`, `ActionCount`, `Overview`, `Health`; `UserCount` gains `activity` |

**Why `week` is the default:** 3,063 events over ~355 days is 8.6/day. Daily
buckets are noise; weekly gives ~59 events across 52 points. A data-driven
default, not an arbitrary one.

---

## 3. Frontend

### 3.1 Shared top filter bar

Replaces the full-height left rail. The rail made filters — touched once per
session — permanent furniture, and left the screen's actual subject in the
smaller half.

- A **range chip** stating the current window, defaulting to
  `All data · Jan 7 – Dec 27, 2024` (no `start_time`/`end_time` sent; the backend
  already treats absent bounds as "everything").
- A **Custom…** chip opening the two `datetime-local` inputs, with `min`/`max`
  clamped to the dataset bounds from `/health`. **This is the fix for the
  impossible-window problem** — it makes the bad query untypeable rather than
  merely unhelpful.
- A **bucket** segmented control (`day · week · month`), Overview only.

Timestamps stay UTC end to end. The Phase 4 fix — treat `datetime-local` as UTC,
append `:00Z`, never route it through `new Date()` — carries over unchanged.

### 3.2 Overview screen (`/`)

Stat tiles (events, users, action types, span) → a Chart.js **line** chart of
activity over time → top actions and most-active users. The user entries are
`<Link>`s into `/users?user_id=N`, carrying the current range forward.

### 3.3 Users screen (`/users`)

Master–detail:

- **Left:** a search input over a scrollable list of all users with event counts,
  from the existing `GET /users`. This *is* the picker — always visible, real
  content, our own markup. The `<datalist>` is deleted, not restyled.
- **Right:** the selected user's summary as a tile row, then **Sessions** and
  **Anomalies** as tabs carrying result counts.

Tab lives in the URL as `?tab=sessions|anomalies`, defaulting to `sessions`.
`?page`/`?page_size` belong to whichever tab is active; **switching tabs resets
`page` to 1**, since a page number from one list is meaningless in the other.

An empty anomalies result becomes a quiet `0` on a tab rather than an entire
screen apologising — which matters, because the population-stddev 2σ rule
(CLAUDE.md §4) means most users genuinely have none.

### 3.4 Drill-down

Most-active users on Overview, and a list beneath the Trends chart, link to
`/users?user_id=N` with the current range.

**Real `<Link>`s, not Chart.js canvas click handlers.** Canvas hit-testing isn't
keyboard reachable, can't be middle-clicked or copied, and has no focus ring — it
would undo Phase 7's accessibility work. It is also less code.

### 3.5 `vite.config.ts` — the Phase 5 trap, again

`/users` becomes **both** a proxied API prefix and a client route, exactly the
collision that Phase 5 hit. It needs the existing `bypass: bypassNavigation`
treatment. `/summary`, `/sessions` and `/anomalies` remain client routes (now
redirects), so they keep theirs. `/overview` is API-only — the Overview screen
lives at `/` precisely so this collision never exists — and needs a plain entry.

Keeping this section and `frontend/vite.config.ts` in sync is a standing
requirement (CLAUDE.md §2); a missing entry only surfaces as a 404 on a fresh
clone.

### 3.6 Component changes

| Component | Change |
| --- | --- |
| `TopFilterBar` | new — range chips, custom range popover, bucket control |
| `Overview` | new — tiles, chart, top lists |
| `ActivityChart` | new — Chart.js `Line` |
| `UsersScreen` / `UserList` / `UserDetail` | new — master–detail |
| `SessionsPanel` / `AnomaliesPanel` | new — table markup lifted out of the deleted forms |
| `UserSummaryForm` / `SessionsForm` / `AnomaliesForm` | deleted |
| `ActivityFilters` | loses the user field; folded into `TopFilterBar` |
| `SessionTimeline` / `Pagination` | reused unchanged |
| `useUrlFilters` | gains `bucketed` and `tab`, mirroring how `paginated` works today |
| `useUsers` | retained — now feeds the list instead of a `<datalist>` |
| `useDatasetBounds` | new — reads `/health` once |

---

## 4. Visual design and identity

**Organising concept: the app is an instrument, not a brand.** This is
`docs/design.md`'s own phrase — "the way a measuring instrument does" — promoted
from a passing remark about numerals to the thing every visual decision derives
from. An instrument is precise, dense, quiet and legible. It has tolerances
rather than a personality.

`docs/design.md` is treated as a living document here. Where this phase departs
from it, the departure is written into the doc as an amendment with its reason —
never left as a silent divergence, since every CSS value in the project is
supposed to trace back to that file.

### 4.1 Amendments to `docs/design.md`

| Current text | Amendment | Why |
| --- | --- | --- |
| "Not a dashboard — a dashboard shows you everything at once and answers nothing." | Overview is admitted as a screen that answers one dataset-level question and routes into a user. | Written when the app was per-user only. The objection is to sprawl, not to an entry point. |
| "System font stack stays… Personality comes from the scale and from how numbers are set, not from a display face." | Amended: system stack for UI text, a **monospace for data**. | The doc's own instrument logic argues for it. Declining a display face was right; declining all type identity was not. |
| "No zebra striping." | **Unchanged** — retained. Row rules and hover carry the separation. | Reasoned, and it still holds. |
| "No dark mode." | **Unchanged** — retained. | A real dark variant needs its own token set, not inverted values. Still true. |
| Signature section | Extended: sparklines in the user list, and the anomaly strip as an **emphasis** chart. | Same idea — make the time dimension visible — applied in two more places. |

### 4.2 Type — the data monospace

One additional family, used **only** for numbers, timestamps, durations and user
IDs. UI text, labels and headings stay on the system stack.

- Self-hosted (JetBrains Mono or IBM Plex Mono), subset to latin + digits,
  `font-display: swap`. **No CDN** — the frontend should not depend on a
  third-party host to render text.
- New token `--font-data`. `font-variant-numeric: tabular-nums` stays; the mono
  reinforces it rather than replacing the rule.

### 4.3 Wordmark

The `▪` already reserved in the doc's layout sketch becomes four bars of varying
height at varying gaps — the session-gap pattern from the signature timeline, at
16px. Inline SVG, `--accent`, `aria-hidden` beside the existing text title.
Domain-derived rather than decorative.

### 4.4 Chart craft

Chart.js defaults are recognisable on sight, and the chart becomes the visual
centre of the product. Per the visualization method:

- **Single hue.** These are single-series charts, so one accent is correct and
  there is no categorical palette to get wrong. `#57449a` passes the palette
  validator on lightness band, chroma floor and contrast vs surface.
- Hairline horizontal gridlines in `--muted`; vertical grid off; axes recessive.
- 2px line, no point markers at rest — markers appear on hover.
- Crosshair + tooltip on the time series, tooltip styled as a card with values in
  `--font-data`. Per-mark tooltip on bars.
- Direct-label the peak only, never every point.
- 4px rounded bar ends anchored to the baseline, 2px surface gap between bars.

Forms, chosen before colour: the Overview totals are a **KPI row of stat tiles**
(not a one-bar chart), activity over time is a **line**, trends is a **bar**, and
the anomaly strip is **emphasis** — flagged points in `--accent`, the rest in
de-emphasis grey.

### 4.5 Sparklines in the user list

Each row renders its `activity` series (§2.5) as a ~90px inline SVG polyline,
scaled to its own maximum. Steady, bursty, flat and ramping users become visible
at a glance and are indistinguishable in a column of counts.

Decorative-only, so `aria-hidden`; the count beside it remains the accessible
value.

### 4.6 Polish pass

Applies across every screen, no new dependencies:

- Tabular figures and right-aligned numeric columns everywhere (the doc requires
  this already; it is not fully implemented).
- The doc's motion spec, also not fully implemented: 180ms fade + 4px rise on new
  results; a 2px progress line under the header appearing only after 400ms;
  paginated tables holding previous rows at 60% opacity. All behind
  `@media (prefers-reduced-motion: reduce)`.
- Visible focus rings on every interactive element, including the new list rows,
  tabs and chips.
- Skeleton rows rather than layout-collapsing spinners.

### 4.7 Radix for the two hard primitives

`@radix-ui/react-tabs` and `@radix-ui/react-popover` — headless and unstyled,
styled entirely by the existing tokens. No Tailwind, no shadcn, no visual layer
imported.

The rationale is worth recording: the IA change removed the need for a combobox
(the user list is a search field over an always-visible list, not a popup), which
was the hardest WAI-ARIA pattern here. What remains is tabs and a popover, where
correct roving focus, typeahead and focus trapping are real work with no visual
payoff. **Build the design system, buy the two hard primitives.**

A full shadcn + Tailwind migration was considered and rejected: it would stack a
second migration onto the IA restructure in one diff (CLAUDE.md §5), replace the
token system that Phase 7 was built around, orphan `docs/design.md`, and make the
UI indistinguishable from every other shadcn app.

## 5. Tests

**Backend**

- `overview.test.ts` — UTC bucket boundaries for all three granularities; empty
  buckets present in the series; month stepping across a year boundary; empty
  input; `top_actions`/`top_users` ordering and first-seen tie-break;
  `distinct_actions`.
- `validation` — `parseBucket` default, valid values, 400 on anything else.
- `store.test.ts` — `getDatasetBounds()`, including the never-loaded case;
  `listUserCounts()` sparkline series has fixed length and sums to the count.
- `app.test.ts` — `/overview` 200 / 400 (bad bucket) / 400 (inverted range) /
  503; `/health` carries the new bounds; `/users` carries `activity`.

**Frontend**

- `useUrlFilters.test.tsx` — `?bucket=` and `?tab=` round-trip; switching tab
  resets `page`.
- `UserList` — filters as you type; keyboard navigation; selection writes
  `?user_id=`.
- Redirects — `/summary?user_id=22` lands on `/users?user_id=22`.

---

## 6. Docs

- `README.md` — API section (`/overview`, `/health`'s and `/users`' new fields),
  the three-screen structure, new screenshot.
- `docs/design.md` — the §4.1 amendments, written in with their reasons.
- `docs/roadmap.md` — Phase 8 block; also close the outstanding Phase 7 README item.
- `CLAUDE.md` §4 — new invariants: `/overview` 200s on an empty range; empty
  buckets are emitted; bucket boundaries are UTC; dataset bounds live on
  `/health` and are filter-independent; `/users` sparklines span the dataset, not
  the filter.
- `.gitignore` — add `.superpowers/` and `docs/superpowers/`.

---

## 7. Order of work

Each step ends green (`tsc --noEmit` clean both packages, tests passing), so
stopping between steps leaves a working app.

1. **Backend** — `/overview`, `parseBucket`, dataset bounds on `/health`,
   `/users` sparkline series, tests.
2. **Identity foundations** — `--font-data` and the self-hosted mono, the
   wordmark, the polish pass. Applies to the *existing* screens, so it lands
   value before any restructure.
3. **Routing + filter bar + Overview screen**, with the restyled chart. Old
   screens still reachable and working underneath.
4. **Users master–detail** — Radix tabs, the searchable list with sparklines, old
   forms deleted, redirects added. *This is the step that cannot be half-done.*
5. **Drill-down links, docs, design.md amendments, screenshot.**

Steps 1–3 are additive and each leaves a shippable app. Step 4 is the only
destructive one.

## 8. Risks

- **This is more than one evening.** Honestly scoped, steps 1–5 are two to three
  days. Steps 1–3 alone are a full day and produce a demonstrably better product
  than what exists today. The cut line, if there is one, goes after step 3.
- **Step 4 is the largest single diff since the MVP.** It deletes three
  components and rebuilds their content inside a new screen. If time runs out
  mid-way the app is broken, unlike steps 1–3 which are additive.
- **`useUrlFilters` gains two more concerns** (`tab`, `bucket`) on top of
  `paginated`. If it starts feeling like a flag bag, that's the signal to split
  it — noted, not pre-emptively solved.
- **`/health` and `/users` contract changes** are the only breaking ones here;
  everything else is additive.
- **The mono is a new asset in the build.** Self-hosting means a font file in the
  repo and an `@font-face` rule — small, but it is the first binary asset the
  frontend ships and worth being deliberate about (subset it).

## 9. Out of scope

Unchanged from the roadmap: no database, no auth, no real-time updates, no CSV
upload from the browser, no SSR.

Also explicitly not in this phase:

- **CI and lint setup** — worth doing, but tooling rather than product.
- **Dark mode** — `docs/design.md` rules it out for a good reason (a real dark
  variant needs its own token set, not inverted values), and that reason survives
  this phase.
- **shadcn / Tailwind** — considered and rejected; see §4.7.
- **The anomalies duration-distribution strip** — designed here as an emphasis
  chart (§4.4) but not built, unless steps 1–5 land with time to spare.
