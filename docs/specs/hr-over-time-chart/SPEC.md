# Feature: HR-over-time Chart on the Session Summary

## Intent

The session summary shows a heart-rate trace over elapsed time — avg and max drawn as reference
lines, disconnect and pause gaps drawn as gaps rather than interpolated lines, long sessions
downsampled so they render smoothly — built on a generic SVG line-chart component that M3 reuses
for altitude and weight. A session with no usable HR samples shows no chart frame at all.

## Context

- **Problem statement:** Issue #23 (M2). `PersistedSession.samples` already carries the full
  per-second `HeartRateSample[]` series (`src/interfaces/session.ts`), but the summary screen
  renders only the four scalar stats from `session.stats` — the series is stored and never shown.
  `grep -rn "svg\|chart" src/` returns nothing: there is no charting primitive in the codebase and
  `react-native-svg` is not installed. `docs/ui-reference/session_summary.png` shows a "HEART RATE
  TREND" card between the 2×2 stat grid and the action buttons, with a teal trace and `0m / 15m /
30m / 45m / 54m` x-axis labels — the one element of the mockup not yet built. The spec's
  `recharts` suggestion (`docs/specs.md`, altitude profile) is web-only and does not apply, per
  CLAUDE.md's tech stack note.
- **Current code:**
  - `src/interfaces/session.ts` — `PersistedSession { schemaVersion, id, startedAt, endedAt,
stats, samples, healthConnect? }`. `SessionStats { durationMs, avgHr, maxHr, minHr, sampleCount,
rawSampleCount }`, where `avgHr` / `maxHr` / `minHr` are `null` for a session with no valid
    samples.
  - `src/interfaces/heartRate.ts` — `HeartRateSample { bpm, sensorContact, energyExpended?,
rrIntervals?, timestamp }`. `timestamp` is absolute epoch ms, so elapsed x is
    `timestamp - session.startedAt`.
  - `src/services/session/sessionStats.ts` — `computeSessionStats`, plus the plausibility window
    `MIN_PLAUSIBLE_BPM = 30` / `MAX_PLAUSIBLE_BPM = 220`. The chart must filter on the same window
    so the trace and the stat cards agree.
  - `src/store/workoutSessionStore.ts` — samples are appended **only while `status === 'active'`**,
    so a pause and a BLE disconnect both appear in the persisted series as a time gap between
    consecutive `timestamp`s. Nothing marks the gap explicitly; it has to be inferred from the
    timestamp delta.
  - `src/components/SessionSummaryView.tsx` — the whole summary body, used both as the `/summary/
[id]` screen and as the wide-screen right pane (`variant="pane"`). Order today: hero badge,
    duration block, 2×2 `StatCard` grid, optional "no HR" notice, `HealthConnectSyncBadge`, delete
    pill, back link. Everything sits inside `ResponsiveContent` (max-width clamped, centered), so
    the chart's available width is neither the window width nor a constant.
  - `src/hooks/useSessionDetail.ts` — `getSession(id)` behind `reportError`; returns the full
    `PersistedSession` including `samples`.
  - `src/hooks/useResponsiveLayout.ts` — the only `useWindowDimensions` call site; exposes
    `width`, `sizeClass`, `contentMaxWidth`, `containerPadding`.
  - `src/components/HrZoneBar.tsx` / `src/components/StatCard.tsx` — the established
    presentational-component shape: props in, `@/theme` tokens only, `useTranslation` for every
    string, an `accessible` container with an `accessibilityLabel`. `HrZoneBar` also exports a pure
    helper (`getZoneIndex`) tested directly — the same split applies here, except the pure work is
    large enough to live in `services/`.
  - `src/services/i18n/translations/en.json` / `ja.json` — `summary.*` namespace; interpolation is
    i18n-js `%{name}` syntax (see `healthConnect.syncSyncedAt`).
    `src/tests/services/i18n/localeCoverage.test.ts` fails if `ja.json` misses a key.
  - `src/tests/components/SessionSummaryView.test.tsx` — renders the component against a real MMKV
    fixture (`saveSession`) with `mockSession.samples = []`; that empty array makes it the
    regression test for the "no chart frame" case for free.
  - `jest.config.js` — `jest-expo` preset, `@/` mapped to `src/`; `jest.setup.js` holds the
    module-level mocks (Firebase, Crashlytics).
- **User impact:** A finished session shows the shape of the effort, not just its four numbers —
  where the intervals were, where the drift started, where the strap dropped out. Sessions with no
  HR data look exactly as they do today. M3's altitude profile and weight history get a chart
  component that already exists.
- **Dependencies:** `react-native-svg`, installed with `npx expo install react-native-svg` so the
  SDK 56-compatible version is pinned. It is listed in CLAUDE.md's Milestone 2 stack, so no stack
  decision is being made here. It is a native module: adding it needs a `pnpm android` rebuild of
  the dev client, changes the EAS fingerprint, and cannot ship as an OTA update. It needs no Expo
  config plugin and no new `app.json` permission. Issue #23 lists a dependency on #13 (session
  detail view), which is already merged.

### Facts to confirm during implementation

- **`react-native-svg` under `jest-expo`.** Confirm `<Svg>` / `<Polyline>` render as host
  components in the jest-expo environment. If they throw or render nothing, add a minimal
  `jest.mock('react-native-svg', …)` to `jest.setup.js` mapping each used element to a `View`, and
  keep the component assertions on `testID` / accessibility props rather than on SVG geometry.
- **Installed version and API surface.** Check `https://docs.expo.dev/versions/v56.0.0/` for the
  version `expo install` pins, and confirm `Svg`, `Polyline`, `Line`, `Text as SvgText`, and
  `strokeDasharray` are all exported by it before writing against them.
- **Frame budget on a mid-range device.** Verify the 45-minute acceptance criterion on a real
  device after the rebuild. If a static 240-point polyline still stutters on scroll, reduce
  `HR_CHART_MAX_POINTS` rather than introducing a canvas or an animation library.

## Data Model

No persisted data changes. `PersistedSession`, `SessionStats`, and the MMKV storage layer are
untouched — the chart is a pure derivation of `samples` + `startedAt`, recomputed on render and
memoized. No schema-version bump.

### New: `src/interfaces/chart.ts`

```ts
/** One plotted point in domain units — x is elapsed ms here, distance/date later. */
export interface ChartPoint {
  x: number;
  y: number;
}

/** A contiguous run of points. A break between segments renders as a gap. */
export type ChartSegment = ChartPoint[];

/** Plot bounds in domain units. */
export interface ChartDomain {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Horizontal marker drawn behind the trace (avg / max here). */
export interface ChartReferenceLine {
  value: number;
  label?: string;
  color: string;
  dashed?: boolean;
}

/** One labelled x-axis position, in domain units. */
export interface ChartTick {
  value: number;
  label: string;
}

/** Pixel rect the series is scaled into, inside the SVG viewport. */
export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

`interfaces/` imports nothing from the app, per the layering contract. Nothing in these shapes
mentions heart rate — that is what makes the component reusable for altitude (`x` = distance) and
weight (`x` = date).

## Interfaces / API

### New: `src/services/chart/chartSeries.ts` (pure, no React, no native imports)

```ts
/** Splits where consecutive x values are further apart than `gapThreshold`. */
export function splitOnGaps(
  points: ChartPoint[],
  gapThreshold: number,
): ChartSegment[];

/** Largest-Triangle-Three-Buckets: keeps peaks a naive stride would drop. */
export function downsamplePoints(
  points: ChartPoint[],
  maxPoints: number,
): ChartPoint[];

/** LTTB per segment, budget split proportionally to segment length (min 2 each). */
export function downsampleSegments(
  segments: ChartSegment[],
  maxPoints: number,
): ChartSegment[];

/** Bounds across every segment; null when there is nothing to plot. */
export function computeDomain(
  segments: ChartSegment[],
  options?: { yPadding?: number },
): ChartDomain | null;

/** Domain value → pixel, for a vertical axis that grows upward. */
export function scaleY(
  value: number,
  domain: ChartDomain,
  plot: PlotArea,
): number;

/** Domain value → pixel, horizontal. */
export function scaleX(
  value: number,
  domain: ChartDomain,
  plot: PlotArea,
): number;

/** `"x,y x,y …"` for one `<Polyline points>`. */
export function toPolylinePoints(
  segment: ChartSegment,
  domain: ChartDomain,
  plot: PlotArea,
): string;

/** `count` evenly spaced x positions across the domain, formatted by the caller. */
export function buildXTicks(
  domain: ChartDomain,
  count: number,
  format: (value: number) => string,
): ChartTick[];
```

Behavior and edge cases:

- `splitOnGaps` returns `[]` for an empty input and `[points]` when no delta exceeds the
  threshold. A single-point segment is kept — `LineChart` renders it as a dot, not a line.
- `downsamplePoints` returns the input unchanged when `points.length <= maxPoints` or
  `maxPoints < 3`. First and last points are always retained.
- `computeDomain` returns `null` for `[]` or all-empty segments. When `minY === maxY` (a flat
  trace) it expands the range by `yPadding` (default `5`) in both directions so the line does not
  sit on the frame edge; `maxX === minX` similarly expands by 1 to avoid a divide-by-zero.
- `scaleX` / `scaleY` clamp to the plot rect rather than emitting out-of-range pixels.
- `buildXTicks` returns `[]` when `count < 2`.

### New: `src/services/session/hrChartSeries.ts` (pure)

```ts
/** HR notifications land ~1/s; this much silence is a disconnect or a pause, not jitter. */
export const HR_GAP_THRESHOLD_MS = 15_000;
/** Point budget for one rendered trace. */
export const HR_CHART_MAX_POINTS = 240;

/** Samples → gap-split, downsampled segments in elapsed-ms / bpm units. */
export function buildHrChartSegments(
  samples: HeartRateSample[],
  startedAt: number,
  options?: { gapThresholdMs?: number; maxPoints?: number },
): ChartSegment[];
```

Maps `{ x: timestamp - startedAt, y: bpm }`, dropping any sample outside
`[MIN_PLAUSIBLE_BPM, MAX_PLAUSIBLE_BPM]` (imported from `sessionStats.ts`, not re-declared) and
any with a negative `x`, then `splitOnGaps` → `downsampleSegments`. Returns `[]` when no sample
survives, which is the single condition the chart's "render nothing" branch keys off.

Splitting before downsampling is deliberate: LTTB across a gap would place a bucket that spans it
and emit exactly the interpolated straight line the issue forbids.

### New: `src/components/LineChart.tsx` (generic, presentational)

```ts
export interface LineChartProps {
  segments: ChartSegment[];
  width: number;
  height: number;
  /** Defaults to `computeDomain(segments)`. */
  domain?: ChartDomain;
  referenceLines?: ChartReferenceLine[];
  xTicks?: ChartTick[];
  lineColor?: string;
  strokeWidth?: number;
  /** Required — the chart is one accessibility element, not a tree of nodes. */
  accessibilityLabel: string;
  testID?: string;
}
```

Renders `<Svg width height>` containing, in order: one `<Line>` per reference line (dashed via
`strokeDasharray` when `dashed`), one `<Polyline fill="none">` per segment, one `<SvgText>` per
x-tick along the bottom gutter, and a `<Circle r={strokeWidth}>` for any single-point segment.
Returns `null` when `segments` is empty or the domain is `null`, and when `width <= 0`. Wrapped in
`React.memo`. Colors default to `colors.surfaceTint` (trace) with tick labels in
`colors.onSurfaceVariant`; no hex literals. The outer `<View>` is `accessible`, carries
`accessibilityRole="image"` and the given label, and hides the SVG children from the accessibility
tree — a screen reader gets one sentence, not 240 unlabeled nodes. Reserves a fixed bottom gutter
(24px) for tick labels and a small vertical inset so the trace never touches the frame.

The component knows nothing about heart rate, sessions, time, or bpm. That is the reuse contract
from the issue's notes.

### New: `src/components/HrTrendChart.tsx` (session-specific wrapper)

```ts
export interface HrTrendChartProps {
  samples: HeartRateSample[];
  startedAt: number;
  stats: SessionStats;
}
```

- Builds segments with `buildHrChartSegments`, memoized on `[samples, startedAt]`.
- Returns `null` when the result is `[]` — no card, no title, no empty frame.
- Measures its own width with `onLayout` (it sits inside `ResponsiveContent`, whose width is
  clamped and centered, so the window width is the wrong number). Renders the chart only once a
  positive width has been measured; height is `160` on phones and `200` on tablets via
  `useResponsiveLayout().isTablet`.
- Reference lines: `stats.avgHr` (solid, `colors.primaryContainerOutline`) and `stats.maxHr`
  (dashed, `colors.errorOutline`), each skipped when `null`.
- Domain: `computeDomain(segments)` widened on y to include both reference values so neither is
  clipped.
- X ticks: 5 ticks from `buildXTicks`, formatted `t('summary.chartMinuteTick', { value })` with
  `value = Math.round(ms / 60000)`.
- Card chrome matches the mockup: `colors.surfaceContainerLow` on `radii.md`, title
  `t('summary.hrTrendTitle')` in `type.labelCaps`.
- `accessibilityLabel` = `t('summary.hrTrendAccessibility', { avg, max, minutes })`, falling back
  to the plain title when `avgHr` is `null`.

### New i18n keys (`en.json` and `ja.json`, both files)

| Key                            | English                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `summary.hrTrendTitle`         | `HEART RATE TREND`                                                                 |
| `summary.chartMinuteTick`      | `%{value}m`                                                                        |
| `summary.hrTrendAccessibility` | `Heart rate trend over %{minutes} minutes, average %{avg} bpm, maximum %{max} bpm` |
| `summary.hrTrendAvgLabel`      | `AVG`                                                                              |
| `summary.hrTrendMaxLabel`      | `MAX`                                                                              |

## Files Created

| File                                               | Purpose                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/interfaces/chart.ts`                          | Domain-neutral chart shapes shared by the service and the component.     |
| `src/services/chart/chartSeries.ts`                | Gap splitting, LTTB downsampling, domain, scaling, ticks — pure.         |
| `src/services/session/hrChartSeries.ts`            | HR-specific adapter: samples → chart segments, with the HR constants.    |
| `src/components/LineChart.tsx`                     | Reusable SVG line chart; no domain knowledge.                            |
| `src/components/HrTrendChart.tsx`                  | Summary card wiring session data into `LineChart`.                       |
| `src/tests/services/chart/chartSeries.test.ts`     | Unit tests for gaps, LTTB, domain, scaling, ticks, and degenerate input. |
| `src/tests/services/session/hrChartSeries.test.ts` | Filtering, elapsed-x mapping, gap detection, point budget.               |
| `src/tests/components/LineChart.test.tsx`          | Renders per-segment polylines, reference lines, null cases.              |
| `src/tests/components/HrTrendChart.test.tsx`       | Hidden with no samples, visible with samples, a11y label, tick labels.   |

## Files Modified

| File                                               | Change                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `package.json` / `pnpm-lock.yaml`                  | `react-native-svg` added via `npx expo install`.                                                                          |
| `src/components/SessionSummaryView.tsx`            | Renders `<HrTrendChart>` between the 2×2 stat grid and the "no HR" notice, matching the mockup order.                     |
| `src/services/i18n/translations/en.json`           | The five new `summary.*` keys.                                                                                            |
| `src/services/i18n/translations/ja.json`           | The same five keys, translated — `localeCoverage` fails otherwise.                                                        |
| `src/tests/components/SessionSummaryView.test.tsx` | Adds a with-samples case asserting the chart renders, keeping the existing empty-samples case as the no-chart regression. |
| `jest.setup.js`                                    | Only if `react-native-svg` does not render under `jest-expo` — a minimal element mock.                                    |

## Implementation Steps

1. `npx expo install react-native-svg`, then `pnpm android` to rebuild the dev client. Confirm the
   app still boots before writing chart code — a native module that fails to link is a much
   cheaper failure to find now than after four new modules exist.
2. Add `src/interfaces/chart.ts` with the shapes above.
3. Write `src/services/chart/chartSeries.ts` and `src/tests/services/chart/chartSeries.test.ts`
   together. Cover: empty input; a single point; a gap exactly at and just over the threshold;
   LTTB retaining a lone spike that a stride-based sample would drop; `points.length <= maxPoints`
   returned unchanged; flat-series and single-x domains; clamping in `scaleX` / `scaleY`;
   `buildXTicks` with `count < 2`.
4. Write `src/services/session/hrChartSeries.ts` and its test: implausible bpm dropped on the same
   boundary as `computeSessionStats`, x measured from `startedAt`, a two-minute gap producing two
   segments, 2,700 samples (45 minutes at 1 Hz) reduced to `<= HR_CHART_MAX_POINTS` total across
   segments, and an all-implausible series returning `[]`.
5. Build `src/components/LineChart.tsx` and its test: one `<Polyline>` per segment (two segments →
   two polylines, the visible gap); reference lines rendered and dashed as configured; `null` for
   empty segments and for `width <= 0`; the container's `accessibilityRole` / `accessibilityLabel`.
6. Build `src/components/HrTrendChart.tsx` and its test: returns nothing for an empty/all-invalid
   sample set; renders the title, the tick labels, and the accessibility sentence when samples
   exist; both reference lines omitted when `stats.avgHr` / `stats.maxHr` are `null`. Fire an
   `onLayout` event in the test to give it a width.
7. Add the five keys to `en.json` and `ja.json`, and mount `<HrTrendChart>` in
   `SessionSummaryView.tsx`. Extend `SessionSummaryView.test.tsx` with a with-samples fixture.
8. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`. Then `pnpm android` and
   manually check the three acceptance scenarios on a device: a long session scrolls smoothly, a
   session recorded through a two-minute disconnect shows a break in the trace, and a manually
   saved no-HR session shows the summary with no chart card.

## Style & Conventions

- CLAUDE.md layering: `interfaces/` imports nothing; `services/chart` and `services/session` are
  plain TypeScript with no React import; `components/` reaches services directly here rather than
  through a hook, matching `SessionSummaryView`'s existing use of `formatDuration` — the chart
  derivation is a synchronous pure function with no state, so a hook would add a layer that holds
  nothing. All cross-directory imports use `@/…`.
- CLAUDE.md cross-cutting requirements: every string goes through `t(...)` and lands in both
  locale files; the chart container carries `accessibilityRole` / `accessibilityLabel` and hides
  its SVG children from the a11y tree. No crash-logging wrapper is added — the new code is pure
  arithmetic with no throwing call; the storage read it consumes is already wrapped in
  `useSessionDetail`.
- Theme tokens only (`colors.surfaceTint`, `colors.primaryContainerOutline`, `colors.errorOutline`,
  `radii.md`, `space.*`, `type.labelCaps`). No hex, font size, or radius literal in a component.
  Pixel geometry that is layout, not design — plot insets, the tick gutter — stays as local
  constants in `LineChart`.
- Fonts stay unset per CLAUDE.md's pending-fonts note: SVG tick labels use the system face.
- Comments follow the repo's density: one-line "why" notes on the non-obvious decisions (why split
  before downsampling, why LTTB, why the gap threshold is 15s), nothing narrating the obvious.

## Acceptance Criteria

- [ ] A session with samples renders a `HEART RATE TREND` card on `/summary/[id]` and in the
      wide-screen pane, positioned between the stat grid and the delete action as in
      `docs/ui-reference/session_summary.png`.
- [ ] A session whose samples contain a two-minute break renders as two polylines with a visible
      gap — asserted in `LineChart.test.tsx` and `hrChartSeries.test.ts`, and confirmed on device.
- [ ] A session with zero samples, or with only implausible ones, renders the summary with no
      chart card and no empty frame — covered by the existing `SessionSummaryView` fixture.
- [ ] 2,700 samples reduce to at most `HR_CHART_MAX_POINTS` points before rendering, and a
      45-minute session scrolls without visible stutter on a mid-range device.
- [ ] Avg and max reference lines render when the corresponding stat is non-null and are omitted
      when it is `null`.
- [ ] `LineChart` has no import from `interfaces/session`, `interfaces/heartRate`, or any
      `services/session` module — verifiable by inspection of its import block.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass, including
      `src/tests/services/i18n/localeCoverage.test.ts`.

## Constraints

- **Non-goals:** no y-axis labels or gridlines beyond the two reference lines, no touch scrubbing
  or tooltip, no zoom/pan, no animated draw-in, no HR-zone shading, no chart on the live workout
  screen, and no chart library — SVG primitives only, per the issue.
- The mockup's "Live Data Replay" affordance is out of scope; the card renders a static trace.
- `react-native-svg` is a native dependency: it requires `pnpm android` (Expo Go remains
  unsupported), changes the EAS fingerprint, and cannot be delivered as an OTA update.
- Downsampling is display-only. `PersistedSession.samples` keeps every raw sample, so Health
  Connect write-back and future recomputation are unaffected.
- Pause spans and BLE disconnects are indistinguishable in the persisted series — both render as
  gaps, which is correct for both. Distinguishing them would need a new persisted field and is out
  of scope.
- `HR_GAP_THRESHOLD_MS = 15_000` assumes the ~1 Hz notification cadence of a standard GATT
  `0x180D` device. A slower-reporting strap would show spurious gaps; if one turns up, the
  threshold becomes a per-session value derived from the observed median sample interval — the
  option is left open by keeping it an `options` parameter, not by building it now.
