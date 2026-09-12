# Feature: expo-sqlite Time-Series Store

## Intent

Session metadata and per-second heart-rate samples live in a SQLite database opened by
`src/services/storage/`, existing MMKV-stored sessions are migrated across on first launch
without being destroyed, MMKV holds key-value data only, and the summary screen reads a
downsampled series instead of the whole sample array — with no module outside
`src/services/storage/` aware that SQLite is involved.

## Context

- **Problem statement:** `saveSession` (`src/services/storage/sessionHistoryStorage.ts:9`)
  writes one `PersistedSession` — including its full `samples: HeartRateSample[]` — as a
  single `JSON.stringify`'d MMKV string under `@fitness_tracker/session/<id>`. A one-hour
  session at ~1 sample/s is ~3,600 objects, each with `bpm`, `sensorContact`, `timestamp`,
  and optional `rrIntervals[]`; every read parses all of it. Worse, the Health Connect
  flush walk (`forEachIndexedSession`,
  `src/services/healthConnect/pendingSessionSync.ts:66`) calls `getSession(entry.id)` for
  **every** indexed session just to read `session.healthConnect` and classify it — so
  computing a sync-queue badge count parses every sample of every session ever recorded.
  Adding M3 route points and altitude per session (#27–#29) makes this untenable.
- **Current code:** the storage seam is already in place and is the only thing that knows
  the engine — `mmkvStorage.ts` (generic `getItem`/`setItem`/`removeItem`) and
  `sessionHistoryStorage.ts` (`saveSession`, `getSession`, `getSessionIndex`,
  `deleteSession`, `updateSessionHealthConnect`). Five modules import it:
  `src/hooks/useSessionDetail.ts`, `src/hooks/useSessionHistory.ts`,
  `src/services/session/persistSession.ts`,
  `src/services/healthConnect/pendingSessionSync.ts`, and
  `src/services/healthConnect/writeSessionToHealthConnect.ts`. All five call it
  **synchronously**. `src/services/storage/deviceStorage.ts` (last-paired device) and the
  settings/preferences path stay on MMKV and are untouched.
- **User impact:** the summary screen and the history list open without parsing a whole
  session's sample array; the sync badge stops touching sample data at all. Sessions
  recorded before this change keep working and keep showing identical stats. No visible UI
  change, no new user-facing strings.
- **Dependencies:** `expo-sqlite` is not yet a dependency — install with
  `npx expo install expo-sqlite`. It is a native module, so it needs a dev-client rebuild
  (`pnpm android`) and cannot be verified in Metro alone. `expo-sqlite` needs **no** new
  Android permission, and needs its config plugin only for FTS/SQLCipher/libSQL, none of
  which this feature uses — `app.json` therefore does not change. This blocks #27, #28,
  and #29.

## Data Model

Database file `fitness-tracker.db`, opened once per process via `openDatabaseSync`. Schema
version is tracked with `PRAGMA user_version` (the pattern the SDK 56 docs recommend);
this change ships `user_version = 1`.

```sql
CREATE TABLE sessions (
  id             TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  started_at     INTEGER NOT NULL,
  ended_at       INTEGER NOT NULL,
  duration_ms    INTEGER NOT NULL,
  avg_hr         INTEGER,          -- null when no plausible sample
  max_hr         INTEGER,
  min_hr         INTEGER,
  sample_count     INTEGER NOT NULL,
  raw_sample_count INTEGER NOT NULL,
  health_connect TEXT              -- JSON SessionHealthConnectSync, null until attempted
);
CREATE INDEX idx_sessions_started_at ON sessions (started_at DESC);

CREATE TABLE hr_samples (
  session_id      TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL, -- 0-based insertion order within the session
  timestamp       INTEGER NOT NULL,
  bpm             INTEGER NOT NULL,
  sensor_contact  TEXT NOT NULL,
  energy_expended REAL,
  rr_intervals    TEXT,             -- JSON number[]; null when absent
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX idx_hr_samples_session_time ON hr_samples (session_id, timestamp);

CREATE TABLE route_points (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  timestamp  INTEGER NOT NULL,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  altitude   REAL,
  accuracy   REAL,
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX idx_route_points_session_time ON route_points (session_id, timestamp);
```

- `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` are set on every open;
  cascade delete is what makes `deleteSession` one statement.
- `seq` exists so a downsampled read is a plain index scan (`seq % stride = 0`) rather than
  a window function over the whole series.
- `route_points` is created by migration 1 even though nothing reads or writes it yet —
  the issue scopes the table here, and creating it now means #27 adds an accessor rather
  than a second migration. **No accessor functions for it are part of this change.**
- `sessions.health_connect` stays a JSON column rather than exploded columns:
  `SessionHealthConnectSync` (`src/interfaces/healthConnect.ts`) is written and read whole
  by `writeSessionToHealthConnect`/`pendingSessionSync`, and no query filters on its
  fields — classification happens in TypeScript.

Type changes in `src/interfaces/session.ts`:

```ts
/** One persisted workout's metadata — everything but the sample series. */
export type SessionRecord = Omit<PersistedSession, 'samples'>;
```

`PersistedSession` keeps its `samples` field and remains the shape passed to `saveSession`
and returned by the full `getSession` read (the Health Connect write needs every sample).
`SessionIndexEntry` gains one field:

```ts
export interface SessionIndexEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  avgHr: number | null;
  /** Absent until a Health Connect write has been attempted. */
  healthConnect?: SessionHealthConnectSync;
}
```

The index is no longer a stored value — it is a `SELECT` over `sessions`, so it cannot
drift from the session rows, and carrying `healthConnect` on it costs nothing.
`SESSION_SCHEMA_VERSION` stays `1`: the record's logical shape is unchanged, only its
storage engine.

## Interfaces / API

`src/services/storage/sqliteDatabase.ts` — engine access and schema, no domain knowledge:

```ts
export const DATABASE_NAME = 'fitness-tracker.db';
export const SCHEMA_VERSION = 1;

/** Opens (once), applies pragmas, migrates to SCHEMA_VERSION, returns the handle. */
export function getDatabase(): SQLiteDatabase;
/** Test-only: drops the memoized handle so the next call re-opens. */
export function resetDatabaseForTests(): void;
```

- Lazily memoizes one `openDatabaseSync(DATABASE_NAME)` handle. Migration runs inside
  `withTransactionSync`: read `PRAGMA user_version`, apply each pending step in order, set
  `user_version` at the end. A version **higher** than `SCHEMA_VERSION` (a downgraded
  build) is reported via `reportError` and left untouched rather than migrated backwards.
- Every open/migrate failure is wrapped and reported through
  `src/services/crashService.ts` per `CLAUDE.md`'s crash-logging requirement, then
  rethrown — a database that will not open is not something the storage layer can paper
  over.

`src/services/storage/sessionHistoryStorage.ts` — the seam, same synchronous style:

```ts
export function saveSession(session: PersistedSession): void;
export function getSession(id: string): PersistedSession | null;
export function getSessionRecord(id: string): SessionRecord | null;
export function getSessionIndex(): SessionIndexEntry[];
export function deleteSession(id: string): void;
export function updateSessionHealthConnect(
  id: string,
  sync: SessionHealthConnectSync,
): SessionRecord | null;

export interface HrSampleQuery {
  /** Inclusive lower bound, epoch ms. Default: session start. */
  fromMs?: number;
  /** Inclusive upper bound, epoch ms. Default: session end. */
  toMs?: number;
  /** Cap on rows returned; the series is stride-sampled to fit. Default: no cap. */
  limit?: number;
}

export function getHrSamples(
  sessionId: string,
  query?: HrSampleQuery,
): HeartRateSample[];
export function getHrSampleCount(sessionId: string): number;
```

- `saveSession` is one `withTransactionSync`: `INSERT OR REPLACE` the `sessions` row,
  `DELETE FROM hr_samples WHERE session_id = ?`, then insert the samples through a single
  `prepareSync` statement reused across rows (`finalizeSync` in a `finally`). Re-saving the
  same id replaces the series rather than appending — the same overwrite semantics the
  MMKV version had.
- `getSession` returns metadata plus **all** samples, ordered by `seq`; `null` when the id
  is unknown. Signature and return type are unchanged, so `pendingSessionSync` and
  `writeSessionToHealthConnect` keep compiling.
- `getSessionRecord` is the same read without the sample join — the new default for
  anything that only needs stats.
- `getSessionIndex` returns rows newest-first (`ORDER BY started_at DESC`), which is the
  order `useSessionHistory` and the reversal in `selectPendingSessions` already assume.
- `getHrSamples` applies `fromMs`/`toMs` against `timestamp` and, when `limit` is set and
  the matching count exceeds it, adds `AND seq % ? = 0` with
  `stride = ceil(matchingCount / limit)`. The last sample of the range is always included
  so the trace reaches the session's end. Ordering is by `seq`.
- Read failures follow the existing MMKV wrapper's contract — reported via `reportError`
  and returned as `null`/`[]`, never thrown at the caller. Writes still throw so the
  caller can react.

## Files Created

| File                                                  | Purpose                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/services/storage/sqliteDatabase.ts`              | Opens the database, applies pragmas, runs `user_version` migrations.                         |
| `src/services/storage/sessionMigration.ts`            | One-shot, idempotent copy of MMKV-stored sessions into SQLite.                               |
| `__mocks__/expo-sqlite.ts`                            | `openDatabaseSync` backed by Node's built-in `node:sqlite`, so tests run real SQL in memory. |
| `src/tests/services/storage/sqliteDatabase.test.ts`   | Schema creation, idempotent re-open, downgrade guard.                                        |
| `src/tests/services/storage/sessionMigration.test.ts` | Migration correctness, idempotence, MMKV copy retained, corrupt entries skipped.             |
| `src/tests/services/storage/hrSampleQueries.test.ts`  | `getHrSamples` range bounds, stride downsampling, `getHrSampleCount`.                        |

## Files Modified

| File                                                                    | Change                                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                          | Add `expo-sqlite` via `npx expo install` (Expo-managed version for SDK 56).                                                       |
| `src/interfaces/session.ts`                                             | Add `SessionRecord`; add optional `healthConnect` to `SessionIndexEntry`.                                                         |
| `src/services/storage/sessionHistoryStorage.ts`                         | Reimplement every function over SQLite; add `getSessionRecord`, `getHrSamples`, `getHrSampleCount`; drop the MMKV session keys.   |
| `src/app/_layout.tsx`                                                   | Run `migrateSessionsToSqlite()` once during startup, before the first history read.                                               |
| `src/hooks/useSessionDetail.ts`                                         | Return `{ record, chartSamples, remove }` — metadata via `getSessionRecord`, chart series via `getHrSamples` with a point budget. |
| `src/components/SessionSummaryView.tsx`                                 | Consume the new `useSessionDetail` shape; pass `chartSamples` to `HrTrendChart`.                                                  |
| `src/services/healthConnect/pendingSessionSync.ts`                      | Classify from `getSessionIndex()` entries; load a full session only for the ones actually being written.                          |
| `src/tests/services/storage/sessionHistoryStorage.test.ts`              | Rewrite against SQLite; keep the existing behavioral cases plus cascade-delete coverage.                                          |
| `src/tests/hooks/useSessionDetail.test.tsx`                             | Update to the new return shape and the sample-budget read.                                                                        |
| `src/tests/hooks/useSessionHistory.test.tsx`                            | Seed via `saveSession` against SQLite instead of clearing MMKV.                                                                   |
| `src/tests/components/SessionSummaryView.test.tsx`                      | Update to the new hook shape.                                                                                                     |
| `src/tests/services/session/persistSession.test.ts`                     | Assert the round-trip through SQLite.                                                                                             |
| `src/tests/services/healthConnect/pendingSessionSync.test.ts`           | Cover index-based classification and that sample loads happen only for pending sessions.                                          |
| `src/tests/app/history.test.tsx`, `src/tests/app/summary/[id].test.tsx` | Reseed through the SQLite-backed storage seam.                                                                                    |
| `jest.setup.js`                                                         | Reset the in-memory database between tests (`resetDatabaseForTests`).                                                             |

## Implementation Steps

1. `npx expo install expo-sqlite`; confirm the pinned version lands in `dependencies` and
   that `app.json` needs no plugin or permission entry for the features used here.
2. Add `__mocks__/expo-sqlite.ts`: an `openDatabaseSync` returning an object that maps
   `execSync`/`runSync`/`getAllSync`/`getFirstSync`/`getEachSync`/`prepareSync`/
   `withTransactionSync`/`closeSync` onto a `node:sqlite` `DatabaseSync(':memory:')`
   handle, following the shape of the existing `__mocks__/react-native-mmkv.ts` fake. Wire
   the per-test reset into `jest.setup.js`.
3. Write `sqliteDatabase.ts` with the memoized handle, pragmas, and the migration-1 DDL
   above. Test: a fresh open creates all three tables and sets `user_version = 1`; a second
   open is a no-op; a `user_version` above `SCHEMA_VERSION` reports and does not alter the
   schema.
4. Add `SessionRecord` and the `SessionIndexEntry.healthConnect` field to
   `src/interfaces/session.ts`.
5. Reimplement `sessionHistoryStorage.ts` over `getDatabase()`, keeping the five existing
   signatures and adding `getSessionRecord`, `getHrSamples`, `getHrSampleCount`. Extend the
   existing test file: save/read round-trip preserving optional `rrIntervals` and
   `energyExpended`, re-save replacing the series, `deleteSession` cascading samples away,
   index ordering, `updateSessionHealthConnect` on a missing id returning `null`.
6. Implement `getHrSamples`' range + stride behavior and cover it in
   `hrSampleQueries.test.ts`: a 3,600-sample fixture returns at most `limit` rows, spans
   the full range, includes the final sample, and honors `fromMs`/`toMs` bounds.
7. Write `sessionMigration.ts`:
   - Exports `migrateSessionsToSqlite(): { migrated: number; skipped: number }`.
   - Returns immediately when the MMKV flag `@fitness_tracker/session-migration-v1` is
     already `'done'`.
   - Reads the legacy MMKV index at `@fitness_tracker/session-index`, then each
     `@fitness_tracker/session/<id>` blob, and inserts it through `saveSession` inside one
     transaction. A session id already present in `sessions` is skipped, and a blob that is
     missing or fails to parse is reported through `crashService` and skipped — the walk
     never aborts on one bad entry.
   - Sets the flag only after the transaction commits, and **never deletes** the MMKV blobs
     or the legacy index (the issue's "keep the MMKV copy until the migration is verified";
     removal is a later, separate change).
   - Tests: a seeded MMKV session migrates with stats and samples intact; a second call is
     a no-op returning `migrated: 0`; a corrupt blob is skipped while its siblings migrate;
     the MMKV keys still exist afterwards.
8. Call `migrateSessionsToSqlite()` once from `src/app/_layout.tsx` startup, wrapped so a
   failure reports through `crashService` and still renders the app.
9. Point `useSessionDetail` at `getSessionRecord` plus
   `getHrSamples(id, { limit: HR_CHART_MAX_POINTS * 2 })` — `HR_CHART_MAX_POINTS` is
   already exported from `src/services/session/hrChartSeries.ts`; the ×2 headroom leaves
   LTTB in `buildHrChartSegments` something to work with after gap-splitting. Update
   `SessionSummaryView.tsx` to the new shape (stats come from `record.stats`, which already
   carries `sampleCount`, so the sample-count card does not need the series).
10. Rework `pendingSessionSync.ts` so `getSyncQueueSummary` and `selectPendingSessions`
    classify from `getSessionIndex()` entries, and only the sessions that pass the filter
    are loaded with `getSession`. Keep the per-entry try/catch and `reportError` behavior.
11. Update the remaining touched tests, then run
    `pnpm lint && pnpm typecheck && pnpm test`.
12. Rebuild the dev client (`pnpm android`) and smoke-test on device: record a short
    session, confirm it appears in history and opens in the summary with a chart; confirm a
    session recorded on the previous build still opens with the same stats.

## Style & Conventions

- `CLAUDE.md` layering: `sqliteDatabase.ts`, `sessionMigration.ts`, and
  `sessionHistoryStorage.ts` stay under `services/` with no React import — native-module
  access inside a service adapter is explicitly allowed there, as it already is for
  `react-native-ble-plx` and `react-native-mmkv`.
- `CLAUDE.md` storage rules: MMKV keeps key-value data only after this change; the
  migration flag is namespaced `@fitness_tracker/session-migration-v1`, and the SQLite file
  name is not a namespaced key.
- Crash logging: every SQLite call that can throw is wrapped and reported through
  `src/services/crashService.ts`, matching the pattern in `mmkvStorage.ts`.
- Accessibility and i18n: no new user-facing string and no new interactive element, so
  neither cross-cutting requirement adds work here. `SessionSummaryView.tsx`'s existing
  labels and roles are preserved unchanged.
- Expo SDK 56: only the synchronous `expo-sqlite` API documented at
  `https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/` is used, which is what keeps the
  seam's existing synchronous call sites intact.
- Deliberate deviation: the SDK's own docs warn that synchronous calls block the JS thread.
  Staying synchronous is chosen anyway because turning five call sites async — two of them
  React hooks — is a larger behavioral change than this issue scopes, and the queries here
  are single-session index scans. If a real device shows jank on the write path, moving
  `saveSession` to `withTransactionAsync` is a follow-up, not part of this change.

## Acceptance Criteria

- [ ] `expo-sqlite` is a pinned dependency installed via `npx expo install`; `app.json` is
      unchanged.
- [ ] A fresh install creates the `sessions`, `hr_samples`, and `route_points` tables with
      their indexes and `PRAGMA user_version = 1`.
- [ ] No module outside `src/services/storage/` imports `expo-sqlite` — verifiable with
      `grep -rn "expo-sqlite" src | grep -v "src/services/storage"` returning nothing
      outside test files.
- [ ] `src/services/storage/sessionHistoryStorage.ts` contains no
      `@fitness_tracker/session` MMKV key reads or writes.
- [ ] Sessions recorded before the change appear in the history list and open in the summary
      with identical `stats` after migration, and their MMKV blobs still exist.
- [ ] `migrateSessionsToSqlite()` called twice migrates each session once; a corrupt blob is
      skipped and reported without stopping the rest.
- [ ] The summary screen for a 3,600-sample session reads at most `HR_CHART_MAX_POINTS * 2`
      sample rows, asserted in `useSessionDetail`'s test.
- [ ] `getSyncQueueSummary()` reads no `hr_samples` rows, asserted in `pendingSessionSync`'s
      test.
- [ ] `deleteSession(id)` leaves no `hr_samples` rows for that id.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
- [ ] `pnpm android` produces a dev client where recording, history, and summary work end to
      end on device.

## Constraints

- **Non-goal: route points.** The `route_points` table is created, but no read/write API, no
  GPS capture, and no altitude handling. That is #27–#29.
- **Non-goal: removing the MMKV session copy.** Legacy blobs and the legacy index stay in
  place by design; deleting them is a separate change once the migration is verified on
  device.
- **Non-goal: async storage APIs.** The seam stays synchronous (see the deviation note
  above), so no call site changes from sync to `await`.
- **Non-goal: MMKV's other tenants.** `deviceStorage.ts`, units, language, weight, and
  settings stay on MMKV and are not touched.
- **Non-goal: changing the recorded data.** `PersistedSession`, `SessionStats`, and
  `HeartRateSample` keep their shapes; `SESSION_SCHEMA_VERSION` stays `1`.
- The `node:sqlite`-backed mock is a test-time convenience, not a production path. It
  requires the Node 22 already in use (`node -v` → v22.18.0) and emits an experimental
  warning; if that proves noisy in CI it can be silenced per-run rather than replaced.
- SQLite behavior — WAL mode, cascade deletes, `user_version` — cannot be fully verified in
  Jest against the mock; step 12's on-device smoke test is the check that matters for those.
