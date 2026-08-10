# Design direction

The brief for Phase 7a. Every color and type decision in the CSS derives from this
document. If something isn't here, it doesn't go in the stylesheet.

> **Phase 8 amendment (backend only, in progress):** the API now exposes a
> dataset-level `GET /overview` endpoint and gains `dataset_start`/`dataset_end`
> on `/health` plus a per-user `activity` sparkline series on `/users`. These are
> additive contract changes — no existing screen, route, or visual rule below
> was touched. The frontend/IA/visual amendments planned for the rest of Phase 8
> (three-screen structure, data monospace, wordmark, master–detail users screen)
> are documented in
> [`docs/superpowers/plans/2026-08-10-phase-8-product-shape.md`](superpowers/plans/2026-08-10-phase-8-product-shape.md)
> and land, with their own doc updates, once that work is executed.

## The subject

A tool for investigating what one user did, over time. Not a dashboard — a dashboard
shows you everything at once and answers nothing. Each screen answers exactly one
question about one user, and the answer is always shaped by time.

That is the thing to design around. Every record carries a timestamp, sessions are
defined by a 30-minute gap, anomalies are outliers in a duration distribution. Time is
the domain, and right now it is completely invisible — sessions render as a table of
raw ISO strings.

**Audience:** someone who already knows what a session is and wants the answer fast.
Density and legibility beat friendliness. Nothing here needs to be explained with an
illustration.

## Palette

Four brand values, plus two derived. Every color has one job; nothing gets used
"because it's in the palette."

| Token | Hex | Job |
|---|---|---|
| `--surface` | `#e8f1f9` | Page background. Cool, slightly blue — never pure white. |
| `--panel` | `#ffffff` | Cards, table backgrounds. The only pure white in the system. |
| `--muted` | `#d9d7ef` | Table row separators, hover fills, disabled states, chart gridlines. Structural, never decorative. |
| `--accent` | `#57449a` | The single accent. Primary buttons, active nav, chart bars, focus rings, the timeline strip. |
| `--accent-soft` | `#57449a` at 12% | Selected rows, the active nav's underlay, timeline track fill. |
| `--ink` | `#1f252f` | All primary text, table headers, the app header bar. |
| `--ink-muted` | `#5a6472` | Labels, captions, secondary values. Derived from `--ink`. |
| `--danger` | `#a63446` | Errors only. Deliberately outside the brand palette — an error must never read as a brand moment or be mistaken for a button. |
| `--danger-soft` | `#a63446` at 8% | Error message background. |

**Rule:** `--accent` is the only saturated color on screen at rest. If two things are
purple, one of them is wrong. Anomalies do *not* get their own alarm color — a flagged
row is emphasized with weight and a left border in `--accent`, not painted red.
Red means "you did something wrong," not "the data is interesting."

## Type

System font stack stays (a deliberate choice, not a default — the tool should feel
native to the OS it runs on). Personality comes from the scale and from how numbers
are set, not from a display face.

```
--text-xs:   0.75rem   / 1.4   — table captions, pagination status
--text-sm:   0.8125rem / 1.5   — labels, secondary values
--text-base: 0.9375rem / 1.55  — body, table cells, inputs
--text-lg:   1.125rem  / 1.3   — card and screen headings
--text-xl:   1.5rem    / 1.2   — the app title, once, in the header
--text-data: 1.75rem   / 1.1   — the four summary figures
```

Weights: 400 body, 500 labels and table headers, 600 headings. Nothing bolder — 700
on a system stack looks heavy and cheap.

**Tabular numerals everywhere a number appears:**

```css
font-variant-numeric: tabular-nums;
```

This is the single most important type decision in the document. It makes every
duration, count, and timestamp align in a column, the way a measuring instrument
does. On a data tool it is worth more than swapping the font family.

Timestamps and durations are set in `--ink-muted` at `--text-sm`, with the date
de-emphasized relative to the time — within one user's session list, the date repeats
and the time is what varies.

## Spacing

A 4px base, used strictly: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. No arbitrary values.
Table rows get 10px vertical padding — tight enough to scan twenty at once, loose
enough to not blur together.

## Layout

The current layout centers a 960px column and lets a single 380px card float inside
it, so on a wide screen the content sits stranded in the upper left. Fix the cause,
not the symptom:

```
┌──────────────────────────────────────────────────────────┐
│  ▪ Activity Analytics          Summary Trends Sessions ▸ │  ← header, --ink
├────────────────┬─────────────────────────────────────────┤
│                │                                         │
│  User          │   [ the answer ]                        │
│  ┌──────────┐  │                                         │
│  │ 44       │  │   Full remaining width. Tables breathe, │
│  └──────────┘  │   the chart is large, the timeline has  │
│                │   room to mean something.               │
│  From          │                                         │
│  ┌──────────┐  │                                         │
│  └──────────┘  │                                         │
│  To            │                                         │
│  ┌──────────┐  │                                         │
│  └──────────┘  │                                         │
│                │                                         │
│  ( Run query ) │                                         │
│                │                                         │
└────────────────┴─────────────────────────────────────────┘
     280px fixed              fluid, max 1100px
```

The filters become a persistent left rail, not a block inside each card. This is
structurally true: filters live in the URL and persist across screens, so they should
visibly persist too — the rail stays put while the right side changes. It also solves
the centering complaint at the root, because the results region now has a reason to
be wide.

Below 900px the rail collapses to a horizontal filter bar above the results, in a
disclosure that starts open when no query has run and collapsed once results exist.

## Signature: the session timeline

Sessions are currently a table of ISO strings — the least legible possible rendering
of something that is inherently spatial. Above the table, a horizontal strip spanning
the queried range:

```
Jan ──▮▮───▮────────▮▮▮──▮──────────────▮───── Dec
```

Each session is a bar positioned at its real start time, width proportional to
duration, filled in `--accent` on a `--muted` track. Hovering a bar highlights its
table row and vice versa.

This earns its place because the gaps *are* the domain logic — the 30-minute rule is
literally what produces the spacing you see. A user who logs in every morning and one
who binges once a month look completely different at a glance and identical in a
table. This is the one place to spend visual ambition; everything else stays quiet.

Anomalies get a restrained version of the same idea: a duration distribution strip
with flagged points marked, so "2 standard deviations out" becomes something you see
rather than something you take on faith.

## Motion and loading

Requests take ~30ms locally, so a spinner would flash and vanish — worse than nothing.
The real problem is that results swap silently: the numbers for user 44 become the
numbers for user 12 with nothing marking the change.

- **Result transition.** On new data, the result region fades from 0 to 1 over 180ms
  with a 4px upward translate. Brief enough not to feel slow, enough for the eye to
  register that something is now different.
- **Slow requests only.** A 2px progress line in `--accent` under the header, appearing
  only after 400ms. Fast queries never show it.
- **Paginated tables** keep their previous rows (`keepDataOnLoad` already does this)
  at 60% opacity while loading, so the table never collapses and reflows.
- Nothing else animates. No hover lifts on cards, no staggered row entrances.

All of it inside `@media (prefers-reduced-motion: reduce)` guards that drop to
instant.

## Components

**Buttons.** Pill shape — `border-radius: 999px`, not `80%` (a percentage radius on a
rectangle produces a distorted ellipse; 999px gives a true capsule at any height).
Primary: `--accent` fill, white text. Secondary: transparent with a 1px `--accent`
border. Height 40px, horizontal padding 20px.

**Inputs.** 1px `--muted` border, 6px radius — squared against the pill buttons, so
the button always reads as the action and the fields as containers. Focus: 2px
`--accent` ring with a 2px offset, visible and never removed.

**Tables.** No outer border, no zebra striping. A 1px `--muted` rule between rows and
a 2px `--ink` rule under the header. Numeric columns right-aligned, tabular. Row hover
in `--accent-soft`.

**Cards.** White on the blue-tinted surface, 1px `--muted` border, 10px radius. One
soft shadow only: `0 1px 2px rgba(31, 37, 47, 0.06)`. No layered or colored shadows.

## Copy

The interface currently speaks in system terms. It should speak in the user's:

| Now | Instead |
|---|---|
| `Submit` | `Run query` — say what happens |
| `User ID` | `User` — the field takes a number; the label doesn't need to say so |
| `Start time (optional)` / `End time (optional)` | `From` / `To` — optionality is shown by the field being empty and valid, not stated |
| `No anomalies found for this user.` | `No anomalies in this range. Try widening the dates or another user.` — an empty state is an invitation to act |
| `Something went wrong.` | Name what failed and what to do about it |

Sentence case throughout. An action keeps its name across the whole flow — the button
that says "Run query" produces a heading that says "Query results," not "Output."

## Known bug to fix in this phase

`formatDuration` prints `2m 35.08000000000001s`. The backend rounds `avg_duration` to
two decimals, but `seconds % 60` reintroduces float error. Round the remainder in the
formatter. No palette rescues a number that looks like that.

## Out of scope

No dark mode (the palette is built for light; a real dark variant needs its own token
set, not inverted values). No icon set beyond what nav and pagination require. No
illustrations or empty-state artwork.
