# Feature: GPS Route Sampling During a Workout (Foreground)

## Intent

During an active workout session, the app samples foreground GPS coordinates at regular intervals, filters inaccurate points, accumulates route points and distance in memory, persists the route series to the existing SQLite `route_points` table upon stopping, and displays cumulative distance live and on the summary screen — without background tracking or draining battery during pauses.

## Context

- **Problem statement:** [Issue #27](https://github.com/alvinyanson/fitness-tracker/issues/27) — Milestone 3 in `docs/specs.md` requires:
  - "Sample GPS coordinates at intervals during the workout, stored as a lat/lng array per session."
  - "Needs foreground location permission at minimum."
  - "Battery optimization, understanding of what is draining the battery in this setup."
    Currently, `fitness-tracker.db` has the `route_points` table created in migration 1 (`src/services/storage/sqliteDatabase.ts`), but no code captures GPS coordinates, writes to `route_points`, or calculates distance. `expo-location` is not installed.
- **Current code:**
  - `src/services/storage/sqliteDatabase.ts` created `route_points` (`session_id`, `seq`, `timestamp`, `latitude`, `longitude`, `altitude`, `accuracy`), but has no accessor functions.
  - `src/store/workoutSessionStore.ts` holds `samples: HeartRateSample[]` and handles `start`, `pause`, `resume`, `stop`.
  - `src/hooks/useWorkoutSession.ts` drives session timers, subscribes to HR while `status === 'active'`, and persists the session on `stop`.
  - `src/services/units/formatMeasurement.ts` already has `formatDistance(meters, ctx)`, ready to format distance values into metric (`km`) or imperial (`mi`).
- **User impact:** Users who start an active workout with location permission see live distance on the workout screen. On stopping, total distance and route points are saved and displayed on the summary screen. If permission is denied, workouts record HR and duration normally without distance or errors.
- **Dependencies:**
  - `expo-location` (pinned Expo-managed package via `npx expo install expo-location`).
  - Precedent: Issue #26 (`docs/specs/expo-sqlite-time-series-store/SPEC.md`), which created the `route_points` table.
  - Prerequisite for Issue #28 (Route map redraw / polyline) and Issue #29 (Altitude profile / line chart).

## Data Model

New file `src/interfaces/location.ts`:

```ts
/** One raw or filtered GPS route point. */
export interface RoutePoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}
```

Type changes in `src/interfaces/session.ts`:

```ts
export interface WorkoutSessionSnapshot {
  status: WorkoutSessionStatus;
  reconnecting: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  stoppedElapsedMs: number | null;
  samples: HeartRateSample[];
  /** Appended only while `active`. */
  routePoints: RoutePoint[];
}

export interface SessionStats {
  durationMs: number;
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  sampleCount: number;
  rawSampleCount: number;
  /** Cumulative distance in meters; null if no GPS data recorded. */
  distanceMeters: number | null;
}

export interface PersistedSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  id: string;
  startedAt: number;
  endedAt: number;
  stats: SessionStats;
  samples: HeartRateSample[];
  /** Optional GPS route series; omitted or empty for indoor/non-GPS workouts. */
  routePoints?: RoutePoint[];
  healthConnect?: SessionHealthConnectSync;
}

export type SessionRecord = Omit<PersistedSession, 'samples' | 'routePoints'>;

export interface SessionIndexEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  avgHr: number | null;
  distanceMeters?: number | null;
  healthConnect?: SessionHealthConnectSync;
}
```

Database schema changes in `src/services/storage/sqliteDatabase.ts`:

- Bump `SCHEMA_VERSION = 2`.
- Apply migration 2: `ALTER TABLE sessions ADD COLUMN distance_meters REAL;`.
- The `route_points` table definition (from migration 1) is reused as-is:

```sql
CREATE TABLE IF NOT EXISTS route_points (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  timestamp  INTEGER NOT NULL,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  altitude   REAL,
  accuracy   REAL,
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_route_points_session_time ON route_points (session_id, timestamp);
```

## Interfaces / API

### `src/services/location/distanceMath.ts` (pure, dependency-free)

```ts
/** Rejects GPS points with horizontal accuracy worse than 50 meters. */
export const MAX_PLAUSIBLE_ACCURACY_METERS = 50;

/** Great-circle distance between two coordinates in meters via Haversine. */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number;

/** Cumulative distance across an array of RoutePoints, skipping fixes with accuracy > 50m. */
export function calculateRouteDistance(points: RoutePoint[]): number;
```

### `src/services/location/routeTracking.ts` (native adapter)

```ts
/** Requests foreground location permission from expo-location. Returns true if granted. */
export function requestLocationPermission(): Promise<boolean>;

/**
 * Starts expo-location watchPositionAsync while active.
 * Uses LocationAccuracy.High, timeInterval: 2000ms, distanceInterval: 5m.
 * Returns an unsubscribe callback.
 */
export function startRouteTracking(
  onPoint: (point: RoutePoint) => void,
  onError?: (error: Error) => void,
): Promise<() => void>;
```

### `src/services/storage/sessionHistoryStorage.ts` (storage accessors)

```ts
export function saveSession(session: PersistedSession): void;
export function getRoutePoints(sessionId: string): RoutePoint[];
export function getRoutePointCount(sessionId: string): number;
```

- In `saveSession`: inside the existing transaction, `DELETE FROM route_points WHERE session_id = ?`, and if `session.routePoints` exists, insert rows using a prepared statement.
- Update `INSERT INTO sessions` statement to include `distance_meters`.
- `getRoutePoints(sessionId)`: queries `route_points` ordered by `seq ASC`.
- `getSessionRecord` and `getSessionIndex`: read `distance_meters`.

### `src/store/workoutSessionStore.ts`

- Add `routePoints: RoutePoint[]` to snapshot and initial state.
- Add `addRoutePoint(point: RoutePoint): void` (appends only when `status === 'active'`).
- `start()`: resets `routePoints: []`.

### `src/hooks/useWorkoutSession.ts`

- Add `useEffect` subscribing to `startRouteTracking(addRoutePoint)` when `status === 'active'`. Unsubscribes on cleanup (when paused, stopped, or unmounted) to save battery.
- Expose `distanceMeters: number | null` calculated live via `calculateRouteDistance(routePoints)`.
- In `stop()`: `persistCompletedSession` calculates `stats.distanceMeters` and attaches `routePoints`.

## Files Created

| File                                                | Purpose                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/interfaces/location.ts`                        | Shared `RoutePoint` type.                                                   |
| `src/services/location/distanceMath.ts`             | Pure Haversine distance math and accuracy filtering.                        |
| `src/services/location/routeTracking.ts`            | Thin wrapper around `expo-location` permissions and `watchPositionAsync`.   |
| `__mocks__/expo-location.ts`                        | Jest mock for `requestForegroundPermissionsAsync` and `watchPositionAsync`. |
| `src/tests/services/location/distanceMath.test.ts`  | Unit tests for distance calculation and accuracy thresholding.              |
| `src/tests/services/location/routeTracking.test.ts` | Unit tests for permission handling and position watcher subscription.       |

## Files Modified

| File                                                       | Change                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `package.json`                                             | Add `expo-location` via `npx expo install expo-location`.                                                       |
| `app.json`                                                 | Add `"expo-location"` to `plugins`; add `"android.permission.ACCESS_COARSE_LOCATION"` to `android.permissions`. |
| `src/interfaces/session.ts`                                | Add `routePoints` to `WorkoutSessionSnapshot`; add `distanceMeters` to `SessionStats` and `SessionIndexEntry`.  |
| `src/services/storage/sqliteDatabase.ts`                   | Bump `SCHEMA_VERSION = 2`; apply migration 2 adding `distance_meters REAL` to `sessions`.                       |
| `src/services/storage/sessionHistoryStorage.ts`            | Save and query `route_points`; read `distance_meters` in `getSessionRecord` and `getSessionIndex`.              |
| `src/services/session/persistSession.ts`                   | Compute `distanceMeters` via `calculateRouteDistance` and attach `routePoints` to `PersistedSession`.           |
| `src/store/workoutSessionStore.ts`                         | Add `routePoints` state and `addRoutePoint` action.                                                             |
| `src/hooks/useWorkoutSession.ts`                           | Subscribe to route tracking while `status === 'active'`; expose live `distanceMeters`.                          |
| `src/app/(tabs)/workout.tsx`                               | Display live distance using `formatDistance`.                                                                   |
| `src/components/SessionSummaryView.tsx`                    | Display distance stat card when `distanceMeters !== null`.                                                      |
| `src/services/i18n/translations/en.json`                   | Add `workout.distance` and `summary.distance`.                                                                  |
| `src/services/i18n/translations/ja.json`                   | Add Japanese translations for distance labels.                                                                  |
| `src/tests/services/storage/sqliteDatabase.test.ts`        | Add tests verifying schema version 2 upgrade.                                                                   |
| `src/tests/services/storage/sessionHistoryStorage.test.ts` | Add tests for `route_points` persistence, deletion, and retrieval.                                              |
| `src/tests/store/workoutSessionStore.test.ts`              | Add tests for `addRoutePoint` and store reset.                                                                  |
| `src/tests/hooks/useWorkoutSession.test.ts`                | Verify route tracking lifecycle across active/paused/stopped.                                                   |
| `src/tests/app/workout.test.tsx`                           | Update tests to assert distance readout.                                                                        |
| `src/tests/components/SessionSummaryView.test.tsx`         | Update tests to assert distance card rendering.                                                                 |

## Implementation Steps

1. Run `npx expo install expo-location`; add `"expo-location"` plugin and `"android.permission.ACCESS_COARSE_LOCATION"` permission in `app.json`.
2. Create `__mocks__/expo-location.ts` with test helpers.
3. Add `src/interfaces/location.ts` and update `src/interfaces/session.ts`.
4. Implement `src/services/location/distanceMath.ts` and write tests in `distanceMath.test.ts`.
5. Implement `src/services/location/routeTracking.ts` and write tests in `routeTracking.test.ts`.
6. Add migration 2 (`ALTER TABLE sessions ADD COLUMN distance_meters REAL`) to `sqliteDatabase.ts` and update `sqliteDatabase.test.ts`.
7. Update `sessionHistoryStorage.ts` to save and read `route_points`; update `sessionHistoryStorage.test.ts`.
8. Update `workoutSessionStore.ts` (`addRoutePoint`, `routePoints: []`) and test in `workoutSessionStore.test.ts`.
9. Update `useWorkoutSession.ts` to start tracking while `status === 'active'` and unsubscribe on pause/stop; update `persistSession.ts` to compute `distanceMeters`.
10. Add translation keys (`en.json`, `ja.json`) and display distance in `workout.tsx` and `SessionSummaryView.tsx`.
11. Run repository verification:
    ```bash
    pnpm lint
    pnpm typecheck
    pnpm test
    ```
12. Smoke-test on Android dev-client (`pnpm android`).

## Style & Conventions

- `CLAUDE.md` layering: `distanceMath.ts` and `routeTracking.ts` live in `services/location/` with zero React imports.
- Storage rules: Time series points persist to SQLite (`route_points` table). MMKV remains key-value only.
- Battery conservation: Watcher is strictly active while workout is active; paused workout unsubscribes.
- Error handling: Location errors are caught and logged through `crashService.reportError`.
- i18n & Accessibility: Distance values formatted via `formatDistance`; cards include accessible roles and labels.

## Acceptance Criteria

- [ ] `expo-location` is installed as a pinned Expo dependency in `package.json` and configured in `app.json`.
- [ ] Database migrates to `SCHEMA_VERSION = 2` without corrupting existing session records.
- [ ] `calculateRouteDistance` accurately computes distance in meters and filters fixes with accuracy > 50m.
- [ ] Starting a workout when location permission is granted begins GPS tracking; pausing or stopping unsubscribes the watcher.
- [ ] Stopping an active workout saves all recorded route points into SQLite `route_points` linked to `session_id`, and `deleteSession` cascades.
- [ ] Denying location permission does not crash the workout; session records HR and duration normally with `distanceMeters: null`.
- [ ] Live workout screen and session summary screen display formatted distance according to the user's unit settings (km vs mi).
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass with zero errors.

## Constraints

- **Foreground only:** Background location services and tasks are explicitly out of scope (`docs/specs.md`).
- **Android only:** No iOS configuration or code (`CLAUDE.md`).
- **Non-goal: Map rendering:** Polyline redraw on a map is deferred to Issue #28.
- **Non-goal: Altitude line chart:** Altitude elevation profile is deferred to Issue #29.
