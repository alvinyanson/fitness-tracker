# Feature: Write Completed Sessions to Health Connect (ExerciseSession + HR Series)

## Intent

A completed workout that was just saved locally also lands in Health Connect as an
`ExerciseSession` record (plus a `HeartRate` series when the session has samples), exactly
once, with the summary screen showing that session's sync state — synced, not synced,
or failed with a reason and a retry — and with the local save unaffected whether Health
Connect is present, absent, or permission-denied.

## Context

- **Problem statement:** `docs/specs.md` Milestone 2 calls for writing completed sessions
  to Health Connect; issue #16 is that work. Issue #15 (merged as `d08c4ad`, spec at
  `docs/specs/health-connect-setup-availability-guard/SPEC.md`) built only the gate:
  `getHealthConnectAvailability()`, `requestHealthConnectPermissions()`, a settings status
  card, the `expo-build-properties` / `./plugins/withHealthConnectManifest` native config,
  and `READ_EXERCISE` / `WRITE_EXERCISE` in `app.json`. That spec's Constraints section
  says explicitly: "No Health Connect record is read or written by this issue." Nothing in
  `src/services/healthConnect/` inserts a record today, `PersistedSession`
  (`src/interfaces/session.ts`) has no sync field, and `src/app/summary/[id].tsx` shows no
  sync state.
- **Current code:**
  - `src/services/session/persistSession.ts` — `persistCompletedSession(snapshot)` computes
    stats, builds a `PersistedSession` with `id = String(startedAt)` and
    `endedAt = startedAt + stats.durationMs`, calls `saveSession(record)`, returns the
    record. Synchronous.
  - `src/hooks/useWorkoutSession.ts` — `stop()` calls the store's `stop()`, then
    `persistCompletedSession(...)`, then sets `lastCompletedSessionId`.
  - `src/app/workout.tsx` (lines 76–80) — on `status === 'stopped' && lastCompletedSessionId`,
    `router.replace('/summary/<id>')`. Every stop path (button and the hardware-back
    discard confirm) goes through `stop()`, so the summary screen is always the next
    surface after a save.
  - `src/app/summary/[id].tsx` — reads the record once via `getSession(id)` inside
    `useMemo`, renders hero/duration/2×2 stats/no-HR notice/delete/back-link.
  - `src/services/storage/sessionHistoryStorage.ts` — `saveSession`, `getSession`,
    `getSessionIndex`, `deleteSession` over MMKV keys `@fitness_tracker/session/<id>` and
    `@fitness_tracker/session-index`.
  - `src/services/healthConnect/healthConnectAvailability.ts` —
    `getHealthConnectAvailability()` returns `'available' | 'needs-install' |
'needs-update' | 'unsupported'`, and calls `initialize()` on the `SDK_AVAILABLE` path
    (so "available" implies the module is initialized, which every read/write requires).
  - `src/services/healthConnect/healthConnectPermissions.ts` —
    `requestHealthConnectPermissions(permissions)` → `'granted' | 'partial' | 'denied'`.
    There is no "is it already granted" helper yet.
  - `__mocks__/react-native-health-connect.ts` — already exports scriptable
    `getSdkStatus` / `initialize` / `requestPermission` plus stub `jest.fn()`s for
    `getGrantedPermissions` (`[]`) and `insertRecords` (`[]`); those two stubs need real
    scripting hooks for this feature.
  - `src/services/session/sessionStats.ts` — exports `MIN_PLAUSIBLE_BPM` (30) and
    `MAX_PLAUSIBLE_BPM` (220), the same filter this feature's sample mapping reuses so the
    series written to Health Connect matches the `sampleCount`/`avgHr` shown on screen.
- **User impact:** After hitting Stop, the session shows up in the Health Connect app with
  the right duration and heart-rate series without any extra tap. The summary screen gains
  a sync row: synced (with a timestamp), syncing, not synced, or failed with a reason and
  a Retry action. On a device without Health Connect, or with the permission revoked, the
  workout still records, saves, and displays exactly as before — only the sync row changes.
- **Dependencies:** Depends on #15 (merged). No new npm packages —
  `react-native-health-connect@^4.1.3` is already installed and natively configured.
  `app.json` gains two heart-rate health permissions, which is a **native config change:
  `npx expo prebuild --clean` then `pnpm android` — a Metro reload will not pick it up**,
  per `CLAUDE.md`.

### Library facts confirmed against the installed `react-native-health-connect@4.1.3` typings

Read from `node_modules/react-native-health-connect/lib/typescript/` — not from memory.

- `insertRecords(records: HealthConnectRecord[]): Promise<string[]>` — one inserted record
  id per input record, positionally. Both records go in **one** call, so the exercise
  session and its HR series are one native round-trip.
- `ExerciseSessionRecord extends IntervalRecord`:
  `{ recordType: 'ExerciseSession'; startTime: string; endTime: string; exerciseType: number;
title?: string; notes?: string; metadata?: Metadata; ... }`. `startTime`/`endTime` are
  ISO-8601 strings, not epoch numbers.
- `HeartRateRecord extends IntervalRecord`:
  `{ recordType: 'HeartRate'; startTime: string; endTime: string; samples: HeartRateSample[] }`
  where the library's `HeartRateSample` is `{ time: string; beatsPerMinute: number }` —
  a different shape from this repo's `HeartRateSample` in `src/interfaces/heartRate.ts`
  (`{ bpm, timestamp, sensorContact, ... }`). The mapper is the seam between them, and the
  library type must be imported under an alias to avoid a name collision.
- `Metadata` supports `clientRecordId?: string`, `clientRecordVersion?: number`, and
  `recordingMethod?: RecordingMethod`. `RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED
= 1`. A stable `clientRecordId` is Health Connect's own upsert key — a second insert with
  the same `clientRecordId` replaces the record rather than duplicating it, which is the
  platform-level half of this feature's no-duplicates requirement.
- `ExerciseType.OTHER_WORKOUT = 0` — the honest value here; the app records heart rate and
  duration and never asks the user what activity they are doing.
- `getGrantedPermissions(): Promise<(Permission | ...)[]>` exists and returns the currently
  granted set; `Permission` is `{ accessType: 'read' | 'write'; recordType: RecordType }`.
  Its documented caveat — that it keeps reporting revoked permissions until process
  restart — applies **only** after the app itself calls `revokeAllPermissions()`, which
  this app never does. Revocation from system settings is reflected correctly.
- `HealthConnectError extends Error` is exported from `react-native-health-connect`;
  native failures reject rather than resolving a status code, so every call needs a
  `try/catch`.

## Data Model

### New types in `src/interfaces/healthConnect.ts` (appended)

```ts
/** Why a Health Connect write could not complete. */
export type HealthConnectWriteFailureReason =
  | 'unavailable' // Health Connect missing, outdated, or OS-unsupported
  | 'permission-denied' // write permission not granted (or revoked in system settings)
  | 'write-failed'; // insertRecords rejected

/** Terminal, persisted sync outcome for one session. */
export interface SessionHealthConnectSync {
  state: 'synced' | 'failed';
  /** Epoch ms of the attempt that produced `state`. */
  attemptedAt: number;
  /** Set only when `state === 'synced'`. */
  syncedAt?: number;
  /** First id returned by `insertRecords`; the issue's "store the returned record id". */
  exerciseRecordId?: string;
  /** Set only when `state === 'failed'`. */
  reason?: HealthConnectWriteFailureReason;
}

/** Live UI state; `'unsynced'` and `'syncing'` are never persisted. */
export type HealthConnectSyncState =
  'unsynced' | 'syncing' | 'synced' | 'failed';

/** Outcome of one `writeSessionToHealthConnect` call. */
export type HealthConnectWriteResult =
  | { status: 'synced'; sync: SessionHealthConnectSync }
  | { status: 'already-synced'; sync: SessionHealthConnectSync }
  | { status: 'failed'; sync: SessionHealthConnectSync };
```

### Changed type in `src/interfaces/session.ts`

```ts
export interface PersistedSession {
  // ...existing fields unchanged...
  /** Absent until a Health Connect write has been attempted. */
  healthConnect?: SessionHealthConnectSync;
}
```

- `SESSION_SCHEMA_VERSION` stays `1`. The field is optional and additive: every session
  written before this feature reads back as `healthConnect === undefined`, which the code
  treats as `'unsynced'`. Bumping the version would force a migration for no behavioral
  gain.
- `SessionIndexEntry` is **not** extended. The history list is out of this issue's scope
  (the issue names the summary screen only), and adding sync state to the index would mean
  a second write path to keep consistent.
- Persisted state is terminal only (`'synced' | 'failed'`). `'syncing'` is React state in
  the hook; a process kill mid-write leaves the field absent, and the next summary open
  re-attempts — which the `clientRecordId` upsert makes safe.

### Sample-window invariant (the one non-obvious mapping rule)

`endedAt = startedAt + stats.durationMs` and `durationMs` **excludes paused spans**, so on
a paused session the last real-clock sample timestamp can exceed `endedAt`. Health Connect
rejects a `HeartRateRecord` whose samples fall outside its own `[startTime, endTime]`.

Rule: the HR record uses the **same** interval as the exercise session
(`[startedAt, endedAt]`); samples outside that window are dropped, as are implausible bpm
values (reusing `MIN_PLAUSIBLE_BPM`/`MAX_PLAUSIBLE_BPM`), duplicate timestamps (last wins),
and — after all of that — the HR record is omitted entirely if nothing survives. The mapper
returns the dropped count so tests and crash breadcrumbs can see it. The alternative
(stretching the session's `endTime` to cover late samples) was rejected: it would report a
duration to Health Connect that disagrees with the duration on the summary screen, and the
issue's first acceptance criterion is that the duration is correct.

## Interfaces / API

### `src/services/healthConnect/sessionToHealthRecords.ts` (pure, no native import)

```ts
export const HEALTH_CONNECT_CLIENT_RECORD_PREFIX = '@fitness_tracker/session/';

export interface MappedSessionRecords {
  exercise: ExerciseSessionRecord;
  /** Omitted when no sample survives filtering. */
  heartRate?: HeartRateRecord;
  /** Samples excluded by the window / plausibility / dedupe rules. */
  droppedSampleCount: number;
}

export function mapSessionToHealthRecords(
  session: PersistedSession,
  options?: { title?: string },
): MappedSessionRecords;
```

- `exercise`: `recordType: 'ExerciseSession'`, `exerciseType: ExerciseType.OTHER_WORKOUT`,
  `startTime: new Date(session.startedAt).toISOString()`,
  `endTime: new Date(session.endedAt).toISOString()`, `title: options?.title` (the summary
  screen passes a translated title; omitted when absent), and
  `metadata: { clientRecordId: `${PREFIX}${session.id}`, clientRecordVersion: 1,
recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED }`.
- `heartRate`: same `startTime`/`endTime` as the exercise record, `clientRecordId`
  `${PREFIX}${session.id}/hr` (distinct — one client id per record type),
  `samples: [{ time: ISO, beatsPerMinute: bpm }]` sorted ascending by time.
- Degenerate interval: when `session.endedAt <= session.startedAt` (a zero-duration stop),
  the exercise record's `endTime` is `startedAt + 1 ms` — `IntervalRecord` requires
  `endTime > startTime` — and, since the window is then effectively empty, the HR record is
  omitted and every sample counts as dropped.
- Pure and synchronous: no React, no native import, no `Date.now()`. Fully unit-testable,
  which is the issue's explicit "unit tests over the session → record mapping" ask.
- `ExerciseType` / `RecordingMethod` are value imports from `react-native-health-connect`
  (plain constant objects/enums, no native call at import time — the module is mocked in
  tests regardless).

### `src/services/healthConnect/healthConnectPermissions.ts` (extended)

```ts
export const SESSION_WRITE_PERMISSIONS: Permission[] = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'HeartRate' },
];

export async function hasHealthConnectPermissions(
  permissions: Permission[],
): Promise<boolean>;
```

- `hasHealthConnectPermissions` calls `getGrantedPermissions()` and returns whether every
  requested `(accessType, recordType)` pair is present. A rejection is reported via
  `reportError({ scope: 'healthConnectPermissions' })` and resolves `false` — same
  catch/report/safe-default shape as the existing `requestHealthConnectPermissions`.
- Existing `requestHealthConnectPermissions` is unchanged.

### `src/services/healthConnect/writeSessionToHealthConnect.ts`

```ts
export async function writeSessionToHealthConnect(
  session: PersistedSession,
  options?: { title?: string; now?: () => number },
): Promise<HealthConnectWriteResult>;
```

Sequence, short-circuiting on the first failure:

1. `session.healthConnect?.state === 'synced'` → resolve
   `{ status: 'already-synced', sync: session.healthConnect }`. No native call, no write.
   This is the primary duplicate guard; the `clientRecordId` upsert is the backstop.
2. `await getHealthConnectAvailability()` !== `'available'` → `'failed'` /
   `'unavailable'`. (This call also performs `initialize()`, required before
   `getGrantedPermissions`/`insertRecords`.)
3. `await hasHealthConnectPermissions(SESSION_WRITE_PERMISSIONS)`; if `false`, call
   `requestHealthConnectPermissions(SESSION_WRITE_PERMISSIONS)` once and require
   `'granted'` — `'partial'` is a failure here, because a session without its HR series is
   not what was asked for and a partial write would strand the two records. Not granted →
   `'failed'` / `'permission-denied'`.
4. `mapSessionToHealthRecords(session, { title })`, then
   `insertRecords([exercise, ...(heartRate ? [heartRate] : [])])`. The exercise record is
   always first, so `exerciseRecordId = ids[0]`. The HR series' own returned id is
   discarded — nothing reads it (see Constraints).
5. Persist through `updateSessionHealthConnect(session.id, sync)` on **both** the success
   and failure paths, then resolve.

- Every native call sits inside `try/catch`; an unexpected rejection reports via
  `reportError` with `{ scope: 'healthConnectSessionWrite', sessionId }` and resolves
  `'failed'` / `'write-failed'`. The function never throws and never rejects — callers can
  fire it without a `.catch`.
- `options.now` defaults to `Date.now`, injected purely so tests can assert `syncedAt`.
- Never called from `persistCompletedSession` or the store: the local save stays
  synchronous and completes before any Health Connect work begins, per the issue's "never
  block or delay the local save".

### `src/services/storage/sessionHistoryStorage.ts` (extended)

```ts
export function updateSessionHealthConnect(
  id: string,
  sync: SessionHealthConnectSync,
): PersistedSession | null;
```

- Read-modify-write on `@fitness_tracker/session/<id>`: returns `null` (no write) when the
  session is gone — deleted while a write was in flight is a real race, and re-creating a
  deleted session from a stale in-memory copy would be worse than dropping the update.
- Does not touch the session index; `SessionIndexEntry` carries no sync state.

### `src/hooks/useHealthConnectSessionSync.ts`

```ts
export function useHealthConnectSessionSync(
  session: PersistedSession | null,
  options?: { title?: string },
): {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  retry: () => void;
};
```

- Initial state derived from `session?.healthConnect`: `'synced'` / `'failed'` when present,
  `'unsynced'` otherwise.
- Auto-attempt on mount **only** when the initial state is `'unsynced'` — a session that has
  never been written. This is the post-Stop path: `workout.tsx` navigates to the summary
  immediately after the local save, so mounting the summary is the write trigger, and the
  screen shows `'syncing'` → `'synced' | 'failed'` live without any cross-module event bus.
  A persisted `'failed'` does **not** auto-retry (that would silently re-prompt for
  permission and re-hit a broken device on every visit); the user presses Retry.
- `retry()` is a no-op while `state === 'syncing'` or `state === 'synced'`.
- Guards against a state update after unmount (`isMounted` ref), and re-derives when
  `session?.id` changes.

### `src/components/HealthConnectSyncBadge.tsx`

```ts
export function HealthConnectSyncBadge(props: {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  onRetry: () => void;
}): JSX.Element;
```

- Presentational only — no service import, props from the hook, per the layering contract.
- One icon + label + description per state; `'failed'` also renders the reason copy and a
  Retry action; `'unsynced'`/`'synced'`/`'syncing'` render no action.
- Themed from `@/theme` (no hardcoded hex/size/radius), system font (fonts pending),
  all copy via `t(...)`, `accessibilityRole`/`Label`/`Hint`/`State` on the Retry control and
  `accessibilityRole="text"` + a composed label on the status row.

## Files Created

| File                                                                   | Purpose                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/services/healthConnect/sessionToHealthRecords.ts`                 | Pure `PersistedSession` → `ExerciseSessionRecord` + `HeartRateRecord` mapper.       |
| `src/services/healthConnect/writeSessionToHealthConnect.ts`            | Availability → permission → `insertRecords` → persist-result orchestration.         |
| `src/hooks/useHealthConnectSessionSync.ts`                             | React wrapper: derived state, auto-attempt on first mount, retry.                   |
| `src/components/HealthConnectSyncBadge.tsx`                            | Presentational sync row for the summary screen.                                     |
| `src/tests/services/healthConnect/sessionToHealthRecords.test.ts`      | Mapping, sample filtering/dedupe/window, no-HR, degenerate-interval cases.          |
| `src/tests/services/healthConnect/writeSessionToHealthConnect.test.ts` | Skip-when-synced, each failure reason, id assignment, persistence, crash reporting. |
| `src/tests/hooks/useHealthConnectSessionSync.test.ts`                  | Derived initial state, auto-attempt only when unsynced, retry, unmount safety.      |
| `src/tests/components/HealthConnectSyncBadge.test.tsx`                 | Copy/actions per state and per failure reason.                                      |

## Files Modified

| File                                                                | Change                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/interfaces/healthConnect.ts`                                   | Add `HealthConnectWriteFailureReason`, `SessionHealthConnectSync`, `HealthConnectSyncState`, `HealthConnectWriteResult`.                                                                                                                            |
| `src/interfaces/session.ts`                                         | Add optional `healthConnect?: SessionHealthConnectSync` to `PersistedSession`; `SESSION_SCHEMA_VERSION` stays `1`.                                                                                                                                  |
| `src/services/healthConnect/healthConnectPermissions.ts`            | Add `SESSION_WRITE_PERMISSIONS` and `hasHealthConnectPermissions`.                                                                                                                                                                                  |
| `src/services/storage/sessionHistoryStorage.ts`                     | Add `updateSessionHealthConnect(id, sync)`.                                                                                                                                                                                                         |
| `src/app/summary/[id].tsx`                                          | Call `useHealthConnectSessionSync(session, { title })`, render `HealthConnectSyncBadge` between the stats grid / no-HR notice and the delete action.                                                                                                |
| `app.json`                                                          | Add `android.permission.health.READ_HEART_RATE` and `android.permission.health.WRITE_HEART_RATE` to `android.permissions` (existing entries untouched).                                                                                             |
| `__mocks__/react-native-health-connect.ts`                          | Script `getGrantedPermissions` and `insertRecords` (`__setGrantedPermissionsList`, `__setInsertResult` accepting an array or an `Error`), reset both in `__resetMocks`, and export `ExerciseType` / `RecordingMethod` constants used by the mapper. |
| `src/services/i18n/translations/en.json`                            | Add `healthConnect.sync*` keys.                                                                                                                                                                                                                     |
| `src/services/i18n/translations/ja.json`                            | Same key set, Japanese copy (`localeCoverage.test.ts` enforces parity).                                                                                                                                                                             |
| `src/tests/services/storage/sessionHistoryStorage.test.ts`          | Cases for `updateSessionHealthConnect` (updates, leaves the index alone, returns `null` for a missing session).                                                                                                                                     |
| `src/tests/services/healthConnect/healthConnectPermissions.test.ts` | Cases for `hasHealthConnectPermissions` (all present, some missing, rejection → `false` + reported).                                                                                                                                                |
| `src/tests/app/summary/[id].test.tsx`                               | Assert the sync row renders for a synced, an unsynced, and a failed session (hook mocked).                                                                                                                                                          |

## Implementation Steps

1. Extend `src/interfaces/healthConnect.ts` with the four new types, and
   `src/interfaces/session.ts` with the optional `healthConnect` field on
   `PersistedSession` (importing the type from `@/interfaces/healthConnect`).
2. Extend `__mocks__/react-native-health-connect.ts`: scriptable `getGrantedPermissions`
   and `insertRecords` (each accepting a scripted value or an `Error` to throw),
   `__setGrantedPermissionsList` / `__setInsertResult`, both reset in `__resetMocks`, plus
   `ExerciseType` (`OTHER_WORKOUT: 0`) and `RecordingMethod`
   (`RECORDING_METHOD_ACTIVELY_RECORDED: 1`) constants matching the library's values.
3. Implement `src/services/healthConnect/sessionToHealthRecords.ts` per the contract above.
4. Write `src/tests/services/healthConnect/sessionToHealthRecords.test.ts`: ISO conversion
   of `startedAt`/`endedAt`; `exerciseType`/`clientRecordId`/`recordingMethod` values;
   samples mapped to `{ time, beatsPerMinute }` and sorted; implausible bpm dropped;
   samples outside `[startedAt, endedAt]` dropped and counted; duplicate timestamps
   deduped (last wins); zero surviving samples → `heartRate` omitted, exercise record still
   produced; zero-sample session → same; degenerate `endedAt <= startedAt` → `endTime` one
   ms after `startTime` and no HR record; `title` omitted when not supplied.
5. Add `SESSION_WRITE_PERMISSIONS` + `hasHealthConnectPermissions` to
   `src/services/healthConnect/healthConnectPermissions.ts`; extend that file's test with
   the three cases.
6. Add `updateSessionHealthConnect` to `src/services/storage/sessionHistoryStorage.ts`;
   extend `src/tests/services/storage/sessionHistoryStorage.test.ts`.
7. Implement `src/services/healthConnect/writeSessionToHealthConnect.ts` per the five-step
   sequence above.
8. Write `src/tests/services/healthConnect/writeSessionToHealthConnect.test.ts` with
   `healthConnectAvailability`, `healthConnectPermissions`, `sessionHistoryStorage`, and
   `crashService` mocked: already-synced short-circuit makes no native call; `'unavailable'`
   when availability isn't `'available'`; permission already granted skips the request;
   missing permission triggers exactly one request; `'partial'` → `'permission-denied'`;
   success persists `ids[0]` as `exerciseRecordId` plus `syncedAt`; a session with no HR
   record inserts exactly one record; an `insertRecords`
   rejection → `'write-failed'`, `reportError` called, result persisted, no throw.
9. Implement `src/hooks/useHealthConnectSessionSync.ts`.
10. Write `src/tests/hooks/useHealthConnectSessionSync.test.ts` (writer module mocked):
    initial state derived from a persisted `healthConnect`; `'unsynced'` auto-attempts once
    on mount and transitions `'syncing'` → `'synced'`; a persisted `'failed'` does **not**
    auto-attempt; `retry()` attempts and is a no-op while syncing/synced; `null` session is
    inert; no state update after unmount.
11. Add the `healthConnect.sync*` keys to `en.json` — `syncTitle`, `syncStatusUnsynced`,
    `syncStatusSyncing`, `syncStatusSynced`, `syncStatusFailed`, `syncSyncedAt`,
    `syncReasonUnavailable`, `syncReasonPermissionDenied`, `syncReasonWriteFailed`,
    `syncRetry`, `syncRetryHint`, `syncSessionTitle` (the `ExerciseSession` title, e.g.
    "Heart rate workout") — and the identical set to `ja.json`.
12. Implement `src/components/HealthConnectSyncBadge.tsx` (theme tokens only, full
    accessibility props, all copy via `t(...)`) and its test.
13. Wire `src/app/summary/[id].tsx`: call the hook with
    `{ title: t('healthConnect.syncSessionTitle') }`, render the badge below the stats grid
    / no-HR notice and above the delete action.
14. Extend `src/tests/app/summary/[id].test.tsx` with the three sync-row cases.
15. Add the two heart-rate permissions to `app.json`, then
    `npx expo prebuild --clean` and `pnpm android` to rebuild the dev client.
16. Manual device verification against the issue's acceptance criteria: record a session,
    confirm it appears in the Health Connect app with the right duration and HR series;
    reopen the summary and press Retry (no duplicate appears); revoke the app's Health
    Connect permission in system settings and re-run a session (failed state, no crash);
    run a session with the HR strap off (exercise session written, no HR series).
17. `pnpm lint && pnpm typecheck && pnpm test`.

## Style & Conventions

- Layering per `CLAUDE.md`: `services/healthConnect/*` imports no React and nothing from
  `app/`, `components/`, `hooks/`, `store/`, `theme/`; `HealthConnectSyncBadge` imports no
  service and receives everything as props; the hook is the only adapter between them.
- Sync types live in `src/interfaces/healthConnect.ts`, matching the existing
  `HealthConnectAvailability` precedent; `PersistedSession` imports the type rather than
  inlining the shape.
- `HealthConnectSyncState` and `HealthConnectWriteFailureReason` are explicit string unions,
  not booleans/nullable flags, per the "connection state is an explicit union" domain
  convention.
- Every native Health Connect call is wrapped and reported through
  `src/services/crashService.ts`'s `reportError`, per the crash-logging cross-cutting
  requirement (which names Health Connect calls explicitly).
- No hardcoded user-facing string; every new key added to both `en.json` and `ja.json`.
- `accessibilityRole` / `accessibilityLabel` / `accessibilityHint` / `accessibilityState`
  on the new interactive element, matching `HealthConnectStatusCard` and the rest of
  `src/app/summary/[id].tsx`.
- Tests mirror source paths under `src/tests/`; the single repo-root
  `__mocks__/react-native-health-connect.ts` is extended rather than adding inline
  `jest.mock()` factories.
- Storage keys stay namespaced `@fitness_tracker/...`; the `clientRecordId` reuses the same
  namespace so the app's records are identifiable in Health Connect.

## Acceptance Criteria

- [ ] `mapSessionToHealthRecords` produces an `ExerciseSession` record whose
      `startTime`/`endTime` are the ISO forms of `startedAt`/`endedAt`, with
      `exerciseType: 0` and a stable `clientRecordId` of
      `@fitness_tracker/session/<id>`.
- [ ] A session with samples produces a `HeartRate` record whose samples equal the
      in-window, plausible, deduped samples as `{ time, beatsPerMinute }` in ascending time
      order; a session with zero usable samples produces no `HeartRate` record and still
      produces the `ExerciseSession` record.
- [ ] Samples outside `[startedAt, endedAt]` and outside `MIN_PLAUSIBLE_BPM`..
      `MAX_PLAUSIBLE_BPM` are excluded and reflected in `droppedSampleCount`.
- [ ] `writeSessionToHealthConnect` on a session whose `healthConnect.state === 'synced'`
      returns `'already-synced'` and calls no function from `react-native-health-connect`.
- [ ] Availability other than `'available'` → `'failed'` / `'unavailable'`; permission not
      granted after one request → `'failed'` / `'permission-denied'`; an `insertRecords`
      rejection → `'failed'` / `'write-failed'` with `reportError` called — and in no case
      does the promise reject.
- [ ] A successful write persists `state: 'synced'`, `syncedAt`, and `exerciseRecordId`
      onto the stored session via `updateSessionHealthConnect`, leaving the session index
      unchanged.
- [ ] `useHealthConnectSessionSync` auto-attempts exactly once for a never-synced session,
      never auto-attempts for a persisted `'synced'` or `'failed'` session, and `retry()`
      is inert while syncing or synced.
- [ ] The summary screen renders the synced state (with time), the syncing state, and the
      failed state with its reason plus a working Retry control.
- [ ] On device: a recorded session appears in the Health Connect app with the correct
      duration and an HR series matching the recorded samples.
- [ ] On device: reopening a synced session and pressing Retry produces no second record in
      the Health Connect app.
- [ ] On device: with the Health Connect permission revoked in system settings, the summary
      shows the permission-denied failed state and the app does not crash; the session is
      still saved locally and visible in History.
- [ ] On device (or emulator) without Health Connect installed, Stop → summary still works
      end-to-end and the sync row shows the unavailable failed state.
- [ ] `pnpm test` passes with `react-native-health-connect` fully mocked — no real native
      module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `src/tests/services/i18n/localeCoverage.test.ts` passes with the new keys in both
      `en.json` and `ja.json`.

## Constraints

- **Non-goals:** no sync state in the history list or `SessionIndexEntry`; no bulk
  "sync all past sessions" action; no background/retry-on-reconnect scheduler; no
  `netinfo` involvement (Health Connect is on-device and syncs itself, which is exactly
  why the issue calls it the offline-first story); no reads from Health Connect (steps,
  body weight, aggregate queries) — those belong to their own, unfiled issues; no
  `ActiveCaloriesBurned` or `TotalCaloriesBurned` record, since the calorie number on the
  live screen is a placeholder estimate against a hardcoded 70 kg and is not yet a
  spec'd feature; no delete-from-Health-Connect when a local session is deleted (the local
  record is the app's own copy, per the issue's Notes) — `deleteSession` is untouched.
- The write is triggered by the summary screen mounting, not from inside
  `persistCompletedSession` or the workout store. Every stop path already navigates to the
  summary (`src/app/workout.tsx` lines 76–80), the local save has provably completed by
  then, and this keeps `services/session/` free of Health Connect coupling. If a future
  change lets a session end without reaching the summary, the write must move to an
  explicit call site in `useWorkoutSession.stop()` — fire-and-forget, never awaited.
- `exerciseType` is always `OTHER_WORKOUT`; the app has no activity-type picker and
  inventing one is out of scope.
- A `'partial'` permission grant is treated as failure. Health Connect's permission sheet
  does allow granting exercise but not heart rate; splitting the write into two
  independently-permissioned inserts is deliberately not done here, to keep one session's
  sync a single atomic outcome.
- Only the exercise record's returned id is persisted. The HR series' id is deliberately
  dropped: dedupe keys off `state === 'synced'`, re-writes upsert via `clientRecordId`, the
  badge renders neither id, and deleting from Health Connect is a non-goal — and
  `deleteRecordsByUuids` takes a `clientRecordIdsList` anyway, which is derivable from
  `session.id`. Its one lost signal is durable proof that a series was actually written
  (not inferable from `stats.sampleCount`, since the window rules can drop every sample);
  nothing needs that today, so it is not stored.
- Duplicate prevention is two-layered: the persisted `'synced'` state (app-side) and
  `clientRecordId` (platform-side upsert). Neither is removable — clearing app storage
  loses the former, and the latter alone would still re-write on every summary open.
- `app.json` permission changes need `npx expo prebuild --clean` + `pnpm android`; a Metro
  reload will not apply them.
- Health Connect timestamps are ISO-8601 strings in UTC (`toISOString()`); no
  `startZoneOffset`/`endZoneOffset` is sent, so the Health Connect app renders the session
  in the device's current zone. Recording a session and then changing time zones will shift
  how it reads there — accepted, since the app stores only epoch ms and has no zone to
  report.
- Android only, per `CLAUDE.md` — no HealthKit path, no `ios` additions to `app.json`.
