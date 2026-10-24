# Feature: Altitude Profile Chart from GPS Altitude

## Intent

Render an altitude profile line chart over distance alongside the route map on the session summary screen—displaying smoothed GPS altitude, cumulative elevation gain, and loss totals while respecting metric/imperial units and hiding entirely when no usable altitude data exists.

## Context

- **Problem statement:** [Issue #29](https://github.com/alvinyanson/fitness-tracker/issues/29) (Milestone 3 in `docs/specs.md`). Outdoor sessions record GPS fixes with altitude into SQLite (`route_points`), and the summary screen displays the route polyline on a map (`<RouteMapView>`) and heart rate over time (`<HrTrendChart>`). However, altitude data is not visualized anywhere. Android barometer sensor availability is inconsistent across hardware, so GPS altitude—already captured alongside coordinate fixes—is the sole data source. Because raw GPS altitude contains significant vertical jitter, naive plotting and raw delta summation produce jagged charts and wildly inflated elevation gain totals.
- **Current code:**
  - `src/interfaces/location.ts:1-8` defines `RoutePoint { timestamp, latitude, longitude, altitude, accuracy }`.
  - `src/services/storage/sessionHistoryStorage.ts:281-312` provides `getRoutePoints(sessionId): RoutePoint[]`, querying SQLite `route_points` (`altitude` is loaded as `number | null`).
  - `src/hooks/useSessionDetail.ts:36-67` exposes `routePoints` for a session.
  - `src/components/LineChart.tsx:19-149` is the generic SVG line-chart component built in Issue #23; takes `segments: ChartSegment[]`, `domain: ChartDomain`, `xTicks: ChartTick[]`, and `referenceLines?`.
  - `src/services/chart/chartSeries.ts:1-278` provides domain scaling, segment downsampling (`downsampleSegments`), gap splitting (`splitOnGaps`), and tick calculation (`buildXTicks`).
  - `src/services/location/distanceMath.ts:13-36, 67-90` provides `haversineDistance` and `calculateRouteDistance`.
  - `src/utils/unitConversion.ts:7-18` provides `metersToKilometers`, `metersToMiles`, and `metersToFeet`.
  - `src/hooks/useUnitFormat.ts:18-59` provides localized distance and elevation formatting.
  - `src/components/SessionSummaryView.tsx:246-255` renders `<RouteMapView routePoints={routePoints} />` followed by `<HrTrendChart />`.
- **User impact:** Users viewing completed outdoor workouts see an elevation profile plotted over distance, with total elevation gain and loss (e.g. `+120 m / -45 m` or `+394 ft / -148 ft`). Indoor workouts or sessions without altitude data show no empty chart frame.
- **Dependencies:**
  - Issue #23 (`react-native-svg` and generic `LineChart.tsx` component; already merged).
  - Issue #27 (`expo-location` and SQLite `route_points` table; already merged).
  - Issue #28 (`RouteMapView` and `routePoints` exposure in `useSessionDetail`; already merged).
  - No new npm packages, native modules, or config plugins required.

### Facts to Confirm During Implementation

- **GPS Altitude Nullability:** SQLite stores `altitude REAL`. Points where GPS fix lacked altitude report `null`. Points with `altitude === null`, non-finite values, or horizontal accuracy `> 50m` must be rejected before smoothing.
- **Single-sample or Zero-distance Routes:** If all points are at the exact same location (distance = 0) or fewer than 2 points have usable altitude, the component must return `null` to avoid rendering degenerate charts.

## Data Model

Update `src/interfaces/location.ts` to include elevation and altitude profile types:

```ts
/** Elevation gain and loss totals in meters. */
export interface ElevationGainLoss {
  gainMeters: number;
  lossMeters: number;
}

/** Derived altitude profile data ready for chart presentation. */
export interface AltitudeProfileData {
  segments: ChartSegment[];
  domain: ChartDomain;
  xTicks: ChartTick[];
  gain: number;
  loss: number;
  elevationUnit: 'm' | 'ft';
  distanceUnit: 'km' | 'mi';
  totalDistance: number;
  minAltitude: number;
  maxAltitude: number;
}
```

Database schema: `N/A — uses existing SQLite route_points table without migrations.`

## Interfaces / API

### `src/services/location/altitudeProfile.ts`

Pure TypeScript service with no React imports (`CLAUDE.md:68`):

```ts
/** Window size for centered moving average smoothing (5 samples ≈ 10 seconds of movement at 2s GPS interval). */
export const ALTITUDE_SMOOTHING_WINDOW = 5;

/** Minimum elevation delta in meters required to accumulate gain or loss, filtering micro-jitter. */
export const MIN_ELEVATION_DELTA_METERS = 1.0;

/** Plausible altitude bounds in meters (Dead Sea to Everest). */
export const MIN_PLAUSIBLE_ALTITUDE_METERS = -500;
export const MAX_PLAUSIBLE_ALTITUDE_METERS = 9000;

/** Maximum points rendered on the SVG chart before downsampling. */
export const ALTITUDE_CHART_MAX_POINTS = 240;

/** Smooths an altitude array using a centered moving average of windowSize. */
export function smoothAltitude(
  altitudes: number[],
  windowSize?: number,
): number[];

/** Calculates cumulative elevation gain and loss from a smoothed altitude series. */
export function calculateElevationGainLoss(
  smoothedAltitudes: number[],
  minDeltaMeters?: number,
): ElevationGainLoss;

/** Derives plottable chart segments, domain, ticks, and elevation gain/loss for a route. */
export function computeAltitudeProfile(
  routePoints: RoutePoint[],
  unitSystem: UnitSystem,
  options?: {
    smoothingWindow?: number;
    minDeltaMeters?: number;
    maxPoints?: number;
    xTickCount?: number;
  },
): AltitudeProfileData | null;
```

#### Smoothing and Gain/Loss Logic:

1. **Filtering:** Retain only points where `point.altitude !== null`, `Number.isFinite(point.altitude)`, `point.altitude >= MIN_PLAUSIBLE_ALTITUDE_METERS`, `point.altitude <= MAX_PLAUSIBLE_ALTITUDE_METERS`, and `point.accuracy === null || point.accuracy <= MAX_PLAUSIBLE_ACCURACY_METERS` (50m).
2. **Distance Accumulation:** Accumulate distance between consecutive valid points using `haversineDistance`.
3. **Centered Moving Average Window (W = 5):**
   - For point $i$, smoothed altitude is the arithmetic mean of points in $[\max(0, i - 2), \min(N - 1, i + 2)]$.
   - Why 5 points? At standard 2-second sampling interval (`timeInterval: 2000` in `routeTracking.ts`), a 5-point window spans ~10 seconds (15–35 meters at walking/running speeds). This damps rapid vertical GPS oscillation without flattening real terrain topography.
4. **Gain/Loss Accumulation with 1.0m Threshold:**
   - For consecutive smoothed altitudes: $\Delta = alt[i] - alt[i-1]$.
   - If $\Delta \ge 1.0\text{ m}$, add $\Delta$ to `gainMeters`.
   - If $-\Delta \ge 1.0\text{ m}$, add $|\Delta|$ to `lossMeters`.
   - A 1.0m deadband eliminates cumulative noise drift across flat sections.
5. **Unit Conversion & Ticks:**
   - Metric: x in `km` (`metersToKilometers`), y in `m`, gain/loss in `m`.
   - Imperial: x in `mi` (`metersToMiles`), y in `ft` (`metersToFeet`), gain/loss in `ft` (`metersToFeet`).
   - Downsamples segments to `ALTITUDE_CHART_MAX_POINTS` via `downsampleSegments`.
   - Generates 5 xTicks formatted as e.g. `0.0 km`, `2.5 km`, `5.0 km` or `0.0 mi`, `1.5 mi`, `3.0 mi`.

### `src/hooks/useAltitudeProfile.ts`

Adapts `computeAltitudeProfile` for React components (`CLAUDE.md:72`):

```ts
export function useAltitudeProfile(
  routePoints: RoutePoint[],
): AltitudeProfileData | null;
```

Reads `unitSystem` from `useSettingsStore` and returns memoized `AltitudeProfileData | null`.

### `src/components/AltitudeProfileChart.tsx`

Presentational component consuming `useAltitudeProfile`:

```ts
export interface AltitudeProfileChartProps {
  routePoints: RoutePoint[];
}

export function AltitudeProfileChart(
  props: AltitudeProfileChartProps,
): ReactNode;
```

- Returns `null` if `profile === null` or total distance is 0.
- Renders:
  - Card container (`colors.surfaceContainerLow`, `radii.md`).
  - Header with title (`summary.altitudeProfileTitle`) and gain/loss stats (`+120 m  -45 m` or `+394 ft  -148 ft`).
  - Generic `<LineChart>` with computed segments, domain, xTicks, and `colors.surfaceTint`.
  - Accessible label announcing profile distance, gain, and loss.

### `src/components/SessionSummaryView.tsx`

Inserts `<AltitudeProfileChart routePoints={routePoints} />` directly between `<RouteMapView>` and `<HrTrendChart>`.

## Files Created

| File                                                  | Purpose                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/services/location/altitudeProfile.ts`            | Pure math and data derivation: moving average smoothing, gain/loss calculation, unit scaling, and chart segments. |
| `src/hooks/useAltitudeProfile.ts`                     | React hook adapting altitude calculations with user unit system settings.                                         |
| `src/components/AltitudeProfileChart.tsx`             | Presentational component rendering card frame, gain/loss stats, and reusing `<LineChart>`.                        |
| `src/tests/services/location/altitudeProfile.test.ts` | Unit tests for smoothing window, noise rejection, gain/loss accuracy on flat vs climb routes, and unit scaling.   |
| `src/tests/components/AltitudeProfileChart.test.tsx`  | Component tests verifying chart rendering, gain/loss badges, unit switching, accessibility, and null returns.     |

## Files Modified

| File                                               | Change                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/interfaces/location.ts`                       | Export `ElevationGainLoss` and `AltitudeProfileData` interfaces.                                     |
| `src/components/SessionSummaryView.tsx`            | Render `<AltitudeProfileChart routePoints={routePoints} />` below `<RouteMapView>`.                  |
| `src/services/i18n/translations/en.json`           | Add `summary.altitudeProfileTitle`, `summary.elevationGainLabel`, `summary.elevationLossLabel`, etc. |
| `src/services/i18n/translations/ja.json`           | Add Japanese translations for new summary elevation keys.                                            |
| `src/tests/components/SessionSummaryView.test.tsx` | Add tests verifying altitude chart renders when altitude data is present and is omitted when absent. |

## Implementation Steps

1. **Update Interfaces:**
   - Add `ElevationGainLoss` and `AltitudeProfileData` to `src/interfaces/location.ts`.
2. **Implement Altitude Math and Smoothing Service:**
   - Create `src/services/location/altitudeProfile.ts` with `smoothAltitude`, `calculateElevationGainLoss`, and `computeAltitudeProfile`.
   - Write comprehensive unit tests in `src/tests/services/location/altitudeProfile.test.ts`:
     - Test rejection of null, non-finite, out-of-bounds, and low-accuracy points.
     - Test centered moving average smoothing with known window size.
     - Test flat route with synthetic GPS jitter (e.g. alternating ±3m noise) produces ~0m gain/loss with smoothing and threshold.
     - Test continuous climb (e.g. +100m total ascent) accurately captures ~100m gain.
     - Test metric vs imperial unit conversion.
     - Test segment downsampling with large route point arrays (> 500 points).
3. **Add Hook Layer:**
   - Create `src/hooks/useAltitudeProfile.ts` connecting `computeAltitudeProfile` with `useSettingsStore` (`units`).
4. **Add Translations:**
   - Update `src/services/i18n/translations/en.json` and `src/services/i18n/translations/ja.json` with keys:
     - `summary.altitudeProfileTitle` ("ELEVATION PROFILE" / "高度プロファイル")
     - `summary.elevationGainLabel` ("GAIN" / "上昇")
     - `summary.elevationLossLabel` ("LOSS" / "下降")
     - `summary.altitudeProfileAccessibility` ("Elevation profile over %{distance} %{distanceUnit}, elevation gain %{gain} %{elevationUnit}, elevation loss %{loss} %{elevationUnit}")
5. **Implement Altitude Profile Chart Component:**
   - Create `src/components/AltitudeProfileChart.tsx` consuming `useAltitudeProfile`.
   - Integrate `<LineChart>` with `testID="altitude-profile-chart"`.
   - Write unit tests in `src/tests/components/AltitudeProfileChart.test.tsx` testing render output, unit labels, accessibility labels, and null return when points are empty or lack altitude.
6. **Integrate into Summary Screen:**
   - Update `src/components/SessionSummaryView.tsx` to include `<AltitudeProfileChart routePoints={routePoints} />`.
   - Update `src/tests/components/SessionSummaryView.test.tsx` to assert `<AltitudeProfileChart>` presence when route points contain altitude and absence when route points have no altitude.
7. **Verification:**
   - Run repo quality gates:
     ```bash
     pnpm lint
     pnpm typecheck
     pnpm test
     ```

## Style & Conventions

- **Layering:** `altitudeProfile.ts` is pure TypeScript in `services/location/` with zero React imports. `AltitudeProfileChart.tsx` consumes data exclusively via `useAltitudeProfile` in `hooks/` (`CLAUDE.md:63-74`).
- **Component Reuse:** Strictly reuses `src/components/LineChart.tsx` (the same component backing `HrTrendChart.tsx`) without duplicate SVG chart primitives.
- **Theming:** Card uses `colors.surfaceContainerLow`, `radii.md`, and `space.unit * 4` padding. Line stroke uses `colors.surfaceTint`.
- **Accessibility:** Chart container has `accessible={true}`, `accessibilityRole="image"`, and descriptive localized label detailing total distance, gain, and loss.
- **Graceful Degradation:** Returns `null` if fewer than 2 valid altitude points exist, avoiding empty frames for indoor workouts.

## Acceptance Criteria

- [ ] Route altitude data is read from SQLite `route_points` (`RoutePoint.altitude`); no barometer sensor or iOS altimeter APIs used.
- [ ] 5-sample centered moving average smoothing and 1.0m elevation threshold eliminate synthetic GPS jitter on flat routes while preserving true climbs.
- [ ] `AltitudeProfileChart` reuses `<LineChart>` from #23; no new charting libraries or duplicated SVG primitives.
- [ ] Displays cumulative elevation gain and loss totals alongside the profile line chart.
- [ ] Toggling between metric and imperial updates axes, ticks, gain, and loss (m / km vs ft / mi).
- [ ] Workouts with no GPS route points, fewer than 2 points, or non-finite altitude values render no altitude profile chart or empty frame.
- [ ] All new strings are localized in both `en.json` and `ja.json`, verified by `localeCoverage.test.ts`.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass with 0 errors.

## Constraints

- **No barometer/sensor work:** GPS-reported altitude is the sole elevation data source.
- **Android only:** No Apple HealthKit or iOS `CMAltimeter` code (`CLAUDE.md:16`).
- **Summary view only:** Real-time live elevation charting during active workouts is out of scope.
- **No SQLite schema changes:** Reuses existing `route_points` table columns from migration 1.
