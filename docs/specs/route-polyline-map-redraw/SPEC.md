# Feature: Route Polyline Redraw on a Map

## Intent

Render the recorded GPS route from a completed workout session as a polyline on an
embedded MapLibre map in the session summary screen, auto-fitting the viewport with start
and finish markers, without requiring any proprietary API keys, while rendering nothing
(no empty map frame) for indoor or non-GPS sessions.

## Context

- **Problem statement:** [Issue #28](https://github.com/alvinyanson/fitness-tracker/issues/28) —
  Milestone 3 in `docs/specs.md:67-74` requires drawing the recorded route as a polyline
  on a map after a workout. Issue #27
  ([`docs/specs/gps-route-sampling-foreground/SPEC.md`](file:///C:/Users/AYanson/Desktop/Development/fitness-tracker/docs/specs/gps-route-sampling-foreground/SPEC.md))
  saves route points to SQLite (`route_points`), but no map view exists and no map library
  is installed. To avoid maintaining external API keys or cloud billing accounts,
  `@maplibre/maplibre-react-native` is selected as the open-source map engine.
- **Current code:**
  - `src/interfaces/location.ts:1-8` defines `RoutePoint` (`latitude`, `longitude`,
    `altitude`, `accuracy`, `timestamp`).
  - `src/services/storage/sessionHistoryStorage.ts:281-303` provides
    `getRoutePoints(sessionId): RoutePoint[]` querying SQLite `route_points` ordered by
    `seq ASC`.
  - `src/hooks/useSessionDetail.ts:12-35` reads `record` and `chartSamples`, but does not
    yet return `routePoints`.
  - `src/components/SessionSummaryView.tsx:75-85, 244-250` renders summary cards and
    `HrTrendChart`, but lacks a route map.
  - `package.json:28-39` runs Expo SDK 56 (`react-native` 0.85.3, `react` 19.2.3) with New
    Architecture enabled.
  - `app.json:40-68` does not yet declare the `@maplibre/maplibre-react-native` plugin.
- **User impact:**
  Users viewing a completed outdoor workout see their route on an open-source vector map
  fitted to the screen with start and finish markers. Indoor workouts show no map frame.
- **Dependencies:**
  - `@maplibre/maplibre-react-native` (v11+, New Architecture / Fabric compatible).
  - Open tile style JSON (`https://tiles.openfreemap.org/styles/liberty`, zero API key required).
  - Prerequisite: Issue #27 (`route_points` table and data).

## Data Model

Update `src/hooks/useSessionDetail.ts`:

```ts
export interface SessionDetail {
  record: SessionRecord | null;
  chartSamples: HeartRateSample[];
  /** Loaded from SQLite route_points; empty if no GPS was recorded. */
  routePoints: RoutePoint[];
  remove: () => void;
}
```

`useSessionDetail` exposes `routePoints` so the summary screen can pass them to the map.
GeoJSON coordinates use the standard `[longitude, latitude]` tuple format directly.

## Interfaces / API

### `src/services/location/simplifyRoute.ts`

```ts
/** Target upper bound for rendered map coordinates. */
export const MAX_ROUTE_POINTS = 300;

/** Downsamples route points using uniform stride to GeoJSON [lng, lat] pairs. */
export function simplifyRoute(
  points: RoutePoint[],
  maxPoints?: number,
): [number, number][];
```

`simplifyRoute` filters out any points with non-finite `longitude` or `latitude` and provides
lightweight $O(N)$ stride downsampling. If valid points are within `maxPoints` (default 300),
points are mapped directly to `[longitude, latitude]`. Otherwise, it samples every $N$th point
while always retaining the final coordinate, keeping vector line rendering smooth without
complex geometry math.

### `src/hooks/useSessionDetail.ts`

```ts
/** Reads session record, HR chart samples, and GPS route points. */
export function useSessionDetail(id: string | null): SessionDetail;

/** Memoizes downsampled GeoJSON [lng, lat] coordinates for a route point series. */
export function useSimplifiedRoute(
  routePoints: RoutePoint[],
): [number, number][];
```

`useSessionDetail` calls `getRoutePoints(id)` in the existing `useMemo` block. If `id` is null
or the query fails, returns `routePoints: []`. `useSimplifiedRoute` wraps `simplifyRoute` so
`components/RouteMapView.tsx` consumes route simplification via `hooks/` (`CLAUDE.md:72`).

### `src/components/RouteMapView.tsx`

```ts
export interface RouteMapViewProps {
  routePoints: RoutePoint[];
}

/** Renders route polyline and markers on MapLibre; returns null if < 2 points. */
export function RouteMapView(props: RouteMapViewProps): ReactNode;
```

`RouteMapView` handles display:

1. Returns `null` if fewer than 2 valid route points exist.
2. Converts points to coordinates via `useSimplifiedRoute(routePoints)` (`simplifyRoute(routePoints)`).
3. Computes bounding box `[minLng, minLat, maxLng, maxLat]` for the `<Camera bounds>` prop
   with 32dp padding and `animationDuration={0}` (`duration={0}`) to fit the viewport on open.
4. Renders a card (`colors.surfaceContainer`, `radii.lg`) with:
   - Header title: `t('summary.routeMapTitle')`.
   - `<MapView>`: `scrollEnabled={false}`, `pitchEnabled={false}`, `rotateEnabled={false}`
     (`dragPan={false}`, `touchPitch={false}`, `touchRotate={false}`, `touchZoom={false}`),
     using standard open style URL (`https://tiles.openfreemap.org/styles/liberty`).
   - Height: 200dp on phone, 260dp on tablet (`useResponsiveLayout`).
   - `<ShapeSource id="route" shape={lineStringGeoJson}>` with child `<LineLayer id="routeLayer" style={{ lineColor: colors.primaryContainer, lineWidth: 4 }} />`.
   - Start `<PointAnnotation id="start" coordinate={coordinates[0]} title={t('summary.startMarker')} />`.
   - Finish `<PointAnnotation id="end" coordinate={coordinates[coordinates.length - 1]} title={t('summary.endMarker')} />`.
   - Runtime adapters bridge the spec components/props to `@maplibre/maplibre-react-native` v11 native components (`Map`, `GeoJSONSource`, `Layer` with `type="line"` and `paint`, and `Marker` rendering a dark themed `title` badge + colored dot: `colors.primaryContainer` for start, `colors.error` for finish).

### `src/components/SessionSummaryView.tsx`

```ts
export function SessionSummaryView(props: SessionSummaryViewProps): ReactNode;
```

Renders `<RouteMapView routePoints={routePoints} />` directly above `<HrTrendChart />`.
When `routePoints` is empty, `RouteMapView` returns `null` so no map container is rendered.

## Files Created

| File                                                | Purpose                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/services/location/simplifyRoute.ts`            | Fast stride downsampler capping GeoJSON [lng, lat] coordinates at 300.                     |
| `src/components/RouteMapView.tsx`                   | MapLibre component rendering vector polyline, markers, and viewport fit.                   |
| `src/interfaces/maplibre.d.ts`                      | TypeScript module declarations for `@maplibre/maplibre-react-native` spec and v11 exports. |
| `__mocks__/@maplibre/maplibre-react-native.tsx`     | Jest mock for `MapView`, `Camera`, `ShapeSource`, `LineLayer`, and annotations.            |
| `src/tests/services/location/simplifyRoute.test.ts` | Unit tests for coordinate downsampling and endpoint preservation.                          |
| `src/tests/components/RouteMapView.test.tsx`        | Component tests verifying map render, layer props, and empty-null return.                  |

## Files Modified

| File                                               | Change                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `package.json`                                     | Add `@maplibre/maplibre-react-native` via `npx expo install`.                |
| `app.json`                                         | Add `@maplibre/maplibre-react-native` to `plugins`.                          |
| `src/hooks/useSessionDetail.ts`                    | Include `routePoints` from `getRoutePoints(id)` in `SessionDetail`.          |
| `src/components/SessionSummaryView.tsx`            | Render `<RouteMapView>` above HR chart.                                      |
| `src/services/i18n/translations/en.json`           | Add `summary.routeMapTitle`, `summary.startMarker`, and `summary.endMarker`. |
| `src/services/i18n/translations/ja.json`           | Add Japanese translations for route map keys.                                |
| `src/tests/hooks/useSessionDetail.test.tsx`        | Verify `routePoints` are returned by the hook.                               |
| `src/tests/components/SessionSummaryView.test.tsx` | Verify map is rendered when route points exist and omitted when empty.       |

## Implementation Steps

1. Install `@maplibre/maplibre-react-native` (`pnpm expo install @maplibre/maplibre-react-native`).
2. Add `"@maplibre/maplibre-react-native"` to `plugins` in `app.json`.
3. Create `__mocks__/@maplibre/maplibre-react-native.tsx` mocking `MapView`, `Camera`,
   `ShapeSource`, `LineLayer`, and `PointAnnotation`.
4. Implement `src/services/location/simplifyRoute.ts` and test in
   `src/tests/services/location/simplifyRoute.test.ts`.
5. Update `src/hooks/useSessionDetail.ts` to expose `routePoints` and update
   `src/tests/hooks/useSessionDetail.test.tsx`.
6. Add translation keys to `en.json` and `ja.json`.
7. Implement `src/components/RouteMapView.tsx` and test in
   `src/tests/components/RouteMapView.test.tsx`.
8. Update `src/components/SessionSummaryView.tsx` and test in
   `src/tests/components/SessionSummaryView.test.tsx`.
9. Run repository verification:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
10. Verify on Android dev client (`pnpm android`): confirm route renders on open without
    an API key, and indoor workouts show no map frame.

## Style & Conventions

- `CLAUDE.md` layering: `simplifyRoute.ts` lives in `services/location/` with zero React
  imports.
- Theming: Container uses `colors.surfaceContainer`, `colors.outlineVariant`, and
  `radii.lg`. Polyline stroke uses `colors.primaryContainer` (`#00f0ff` cyan).
- Clean degradation: `RouteMapView` returns `null` if `routePoints.length < 2`.
- Zero API key: MapLibre consumes open vector tiles directly, avoiding Google Cloud
  billing or third-party proprietary tokens.

## Acceptance Criteria

- [ ] `@maplibre/maplibre-react-native` is installed and registered in `app.json` plugins.
- [ ] No external API key is required to render maps.
- [ ] `simplifyRoute` downsamples routes exceeding 300 points while preserving start and
      finish coordinates as GeoJSON `[lng, lat]` pairs.
- [ ] `RouteMapView` renders a vector map with route line and start/finish markers on a dev client.
- [ ] Route auto-fits the viewport on open via `<Camera bounds={...}>`.
- [ ] Sessions with no GPS route points (or < 2 points) show no map frame at all on the
      summary screen.
- [ ] All new strings are localized in both `en.json` and `ja.json`.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass with zero errors.

## Constraints

- **Android only:** No Apple Maps or iOS code (`CLAUDE.md:16`).
- **MapLibre over Google Maps / Mapbox:** `@maplibre/maplibre-react-native` is chosen
  specifically to eliminate API key registration and billing requirements while supporting
  React Native 0.85 New Architecture.
- **Summary view only:** Live workout route drawing is out of scope.
- **Non-goal: Elevation profile:** Line chart of altitude is deferred to Issue #29.
