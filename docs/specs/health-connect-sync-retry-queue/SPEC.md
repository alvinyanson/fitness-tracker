# Feature: Retry Queue for Sessions Not Yet Written to Health Connect

## Intent

Every locally saved session that has not reached Health Connect is retried automatically
when the app comes to the foreground and on demand from a settings action that shows the
pending count — with bounded, backed-off retries, a permanently failing session marked and
surfaced instead of retried forever, and no duplicate record ever written.

## Context

- **Problem statement:** Issue #17. Today a session reaches Health Connect from exactly one
  place: `useHealthConnectSessionSync` (`src/hooks/useHealthConnectSessionSync.ts`)
  auto-attempts a write when the summary screen mounts for a session with no
  `healthConnect` field, and its `retry()` is reachable only while that one summary screen
  is open. Once the user leaves the screen, a session that failed because Health Connect
  was missing, the permission was denied, or `insertRecords` rejected is never retried:
  re-opening the summary does **not** re-attempt (the mount effect fires only when
  `!session.healthConnect`, and a failure persists `state: 'failed'`). There is no pending
  set, no count, no manual action, and no notion of a permanently failed session.
- **Current code:**
  - `src/services/healthConnect/writeSessionToHealthConnect.ts` —
    `writeSessionToHealthConnect(session, { title?, now? })`. Short-circuits
    `'already-synced'`, checks `getHealthConnectAvailability()`, checks
    `hasHealthConnectPermissions(SESSION_WRITE_PERMISSIONS)` and **interactively requests**
    when missing, maps via `mapSessionToHealthRecords`, makes one `insertRecords` call,
    persists the outcome with `updateSessionHealthConnect`, and never rejects. This is the
    single write path this feature reuses; nothing about mapping or the platform call
    changes.
  - `src/interfaces/healthConnect.ts` — `SessionHealthConnectSync`
    (`state: 'synced' | 'failed'`, `attemptedAt`, `syncedAt?`, `exerciseRecordId?`,
    `reason?`), `HealthConnectWriteFailureReason`
    (`'unavailable' | 'permission-denied' | 'write-failed'`), the live-UI union
    `HealthConnectSyncState` (`'unsynced' | 'syncing' | 'synced' | 'failed'`), and
    `HealthConnectWriteResult`. No attempt counter exists, so "bounded retry" has nothing
    to count against today.
  - `src/interfaces/session.ts` — `PersistedSession.healthConnect?: SessionHealthConnectSync`
    is the pending flag the issue asks to derive from ("absent until a write has been
    attempted"). `SESSION_SCHEMA_VERSION = 1`. `SessionIndexEntry` deliberately carries no
    sync state.
  - `src/services/storage/sessionHistoryStorage.ts` — `saveSession`, `getSession(id)`,
    `getSessionIndex()` (newest-first `SessionIndexEntry[]`), `deleteSession`,
    `updateSessionHealthConnect(id, sync)`. Synchronous MMKV over
    `@fitness_tracker/session/<id>` and `@fitness_tracker/session-index`.
  - `src/services/healthConnect/healthConnectPermissions.ts` —
    `hasHealthConnectPermissions(permissions)` (non-interactive; returns `false` and
    reports on error) and `requestHealthConnectPermissions(permissions)` →
    `'granted' | 'partial' | 'denied'`. `SESSION_WRITE_PERMISSIONS` is the
    `ExerciseSession` + `HeartRate` write pair.
  - `src/services/healthConnect/healthConnectAvailability.ts` —
    `getHealthConnectAvailability()`, which also `initialize()`s on the available path.
  - `src/components/HealthConnectSyncBadge.tsx` — renders the four `HealthConnectSyncState`
    cases with an icon, status text, reason text and a Retry control; consumed by
    `src/app/summary/[id].tsx`, which passes
    `{ title: t('healthConnect.syncSessionTitle') }` to the hook.
  - `src/app/settings.tsx` — language options plus `HealthConnectStatusCard`
    (availability only). It never calls `useHealthConnectAvailability().requestPermissions`,
    so there is no in-app permission grant point today.
  - `src/app/_layout.tsx` — `GestureHandlerRootView` + `Stack` + the global `ErrorUtils`
    handler. Nothing app-lifecycle-scoped is mounted there yet, and `AppState` is not
    referenced anywhere under `src/` (verified by grep).
  - `docs/specs/health-connect-session-write-back/SPEC.md` lists "no background/
    retry-on-reconnect scheduler" and "no bulk sync-all action" as explicit non-goals of
    #16 — this issue is where both arrive, minus the background scheduler, which stays out
    per the issue's Notes.
- **User impact:** A user who records workouts before installing Health Connect, or before
  granting the permission, no longer loses those sessions from the health store. After
  granting, the next time the app is foregrounded the backlog is written. Settings gains a
  "Health Connect sync" row: how many sessions are waiting, a "Sync now" button, and a
  distinct count of sessions the app has given up on. The summary badge gains a fifth state
  for a given-up session, whose Retry still works and resets the counter.
- **Dependencies:** Depends on #16 (merged as `b0bc093`). No new npm package, no `app.json`
  change, and no native rebuild — `AppState` is core React Native and the Health Connect
  permission set is unchanged.

### Facts confirmed against the installed code and RN 0.85 typings

- `AppState.addEventListener('change', handler)` returns a subscription with `.remove()`;
  the value is `'active' | 'background' | 'inactive'`. An `'active'` edge (previous state
  not `'active'`) is the foreground signal.
- `insertRecords` upserts on `metadata.clientRecordId`, which `mapSessionToHealthRecords`
  already sets to `@fitness_tracker/session/<id>`
  (`HEALTH_CONNECT_CLIENT_RECORD_PREFIX`). Duplicate protection therefore already exists at
  the platform layer; the app-side guard is the persisted `'synced'` state.
- `__mocks__/react-native-health-connect.ts` already exposes `__setSdkStatus`,
  `__setGrantedPermissionsList`, `__setGrantedPermissions` (the request result),
  `__setInsertResult` and `__resetMocks`, so every flush path is scriptable without new mock
  plumbing.
- `__mocks__/react-native-mmkv.ts` is an in-memory map, so the pending-selection tests can
  run against the real `sessionHistoryStorage` rather than a mocked storage seam.

## Data Model

### Changed: `SessionHealthConnectSync` (`src/interfaces/healthConnect.ts`)

```ts
export interface SessionHealthConnectSync {
  /** `'abandoned'` = retry budget exhausted; still manually retryable. */
  state: 'synced' | 'failed' | 'abandoned';
  attemptedAt: number;
  /** Consecutive `'write-failed'` attempts. Absent on pre-#17 records = 0. */
  failedAttempts?: number;
  syncedAt?: number;
  exerciseRecordId?: string;
  reason?: HealthConnectWriteFailureReason;
}
```

`failedAttempts` is additive and optional, and `'abandoned'` is only ever produced by new
code, so `SESSION_SCHEMA_VERSION` stays `1` and no migration runs. A record persisted by #16
reads back with `failedAttempts === undefined`, treated as `0`.

Only `'write-failed'` increments the counter. `'unavailable'` and `'permission-denied'` are
environmental, not session-specific: counting them would abandon a perfectly good session
just because the user had not installed Health Connect yet, which directly contradicts the
issue's first acceptance criterion.

### Changed: `HealthConnectSyncState`

```ts
export type HealthConnectSyncState =
  'unsynced' | 'syncing' | 'synced' | 'failed' | 'abandoned';
```

### New: queue types (`src/interfaces/healthConnect.ts`, appended)

```ts
/** Counts derived from local sessions; no queue is stored. */
export interface HealthConnectSyncQueueSummary {
  /** Unsynced and not abandoned. */
  pending: number;
  /** Subset of `pending` whose backoff window has elapsed. */
  eligible: number;
  /** Retry budget exhausted; excluded from `pending`. */
  abandoned: number;
}

export type HealthConnectFlushSkipReason =
  'nothing-pending' | 'unavailable' | 'permission-denied' | 'already-flushing';

/** Outcome of one flush pass. */
export interface HealthConnectFlushResult {
  attempted: number;
  synced: number;
  failed: number;
  /** Sessions that crossed `MAX_SYNC_ATTEMPTS` during this pass. */
  abandoned: number;
  /** Eligible sessions left untouched by `maxSessions`. */
  deferred: number;
  skipped: HealthConnectFlushSkipReason | null;
  finishedAt: number;
}
```

### Persistence

No new storage key and no queue store — the pending set is derived by walking
`getSessionIndex()` and loading each `PersistedSession`, exactly as the issue requires. The
only persisted change is the two extra fields on each session's existing `healthConnect`
object, written through the existing `updateSessionHealthConnect`.

## Interfaces / API

### New: `src/services/healthConnect/pendingSessionSync.ts`

```ts
/** Failed attempts after which a session is abandoned. */
export const MAX_SYNC_ATTEMPTS = 5;

/** Backoff before attempt N+1, indexed by `failedAttempts`; last value is the cap. */
export const SYNC_BACKOFF_MS: readonly number[] = [
  0, 60_000, 300_000, 900_000, 3_600_000,
];

/** Cap on writes per pass. */
export const DEFAULT_FLUSH_LIMIT = 25;

export function nextEligibleAt(
  sync: SessionHealthConnectSync | undefined,
): number;

export function selectPendingSessions(options?: {
  now?: number;
  ignoreBackoff?: boolean;
  includeAbandoned?: boolean;
}): PersistedSession[];

export function getSyncQueueSummary(options?: {
  now?: number;
}): HealthConnectSyncQueueSummary;

export function flushPendingSessions(options?: {
  title?: string;
  manual?: boolean;
  maxSessions?: number;
  now?: () => number;
}): Promise<HealthConnectFlushResult>;
```

- `nextEligibleAt(undefined)` → `0` (never attempted, always eligible). Otherwise
  `sync.attemptedAt + SYNC_BACKOFF_MS[min(failedAttempts ?? 0, last index)]`. For a
  `'permission-denied'` or `'unavailable'` failure `failedAttempts` has not moved, so the
  window is the `0`-index entry and the session is eligible on the very next foreground —
  which is what makes "deny, then grant, then foreground" write both sessions.
- `selectPendingSessions` returns **oldest first** (`getSessionIndex()` is newest-first and
  is reversed), skipping `state === 'synced'`, skipping `'abandoned'` unless
  `includeAbandoned`, and skipping sessions still inside their backoff unless
  `ignoreBackoff`. An index entry whose session blob is missing is skipped and reported
  through `reportError`.
- `getSyncQueueSummary` never returns `eligible > pending`, and `abandoned` is disjoint from
  `pending`.
- `flushPendingSessions`:
  1. Returns `skipped: 'already-flushing'` with zeroed counts if a pass is in flight
     (module-level guard cleared in `finally`).
  2. Selects with `ignoreBackoff: manual` and `includeAbandoned: manual`. An empty set →
     `skipped: 'nothing-pending'`.
  3. Checks `getHealthConnectAvailability()` once for the whole pass; not `'available'` →
     `skipped: 'unavailable'` without touching any session's persisted state. Nothing is
     marked failed for an environmental condition the pass already knows about, so a
     device without Health Connect never accumulates failures.
  4. Checks permissions once for the whole pass with `hasHealthConnectPermissions`, and
     when missing calls `requestHealthConnectPermissions` **only if `manual`**. Still not
     granted → `skipped: 'permission-denied'`. An automatic foreground pass therefore never
     raises a system permission sheet.
  5. Writes sequentially — never in parallel — via
     `writeSessionToHealthConnect(session, { title, promptForPermissions: false, manual })`,
     capped at `maxSessions ?? DEFAULT_FLUSH_LIMIT`; the remainder is reported as
     `deferred` and stays pending for the next pass.
  6. Never rejects. An error thrown for a single session is caught, reported through
     `reportError`, counted as `failed`, and the pass continues.

### Changed: `writeSessionToHealthConnect`

```ts
export async function writeSessionToHealthConnect(
  session: PersistedSession,
  options?: {
    title?: string;
    now?: () => number;
    /** Default `true` — preserves the summary screen's behavior. */
    promptForPermissions?: boolean;
    /** User-initiated: clears `failedAttempts` before attempting. */
    manual?: boolean;
  },
): Promise<HealthConnectWriteResult>;
```

Attempt accounting lives here so both call sites — the summary badge's Retry and the queue
flush — share one rule:

- `manual: true` resets the counter to `0` before the attempt, so an abandoned session gets
  a fresh budget when the user explicitly asks.
- `'write-failed'` persists `failedAttempts = prev + 1`, and `state: 'abandoned'` once that
  reaches `MAX_SYNC_ATTEMPTS`; `reason` stays `'write-failed'` so the surfaced text is still
  accurate.
- `'unavailable'` and `'permission-denied'` persist `state: 'failed'` and carry
  `failedAttempts` through unchanged.
- `promptForPermissions: false` skips `requestHealthConnectPermissions` and resolves
  `'permission-denied'` directly.
- The `'already-synced'` short-circuit and the `HealthConnectWriteResult` shape are
  unchanged, so `src/app/summary/[id].tsx` keeps working with no edit.

### New: `src/store/healthConnectSyncStore.ts`

```ts
export interface HealthConnectSyncQueueState {
  status: 'idle' | 'flushing';
  summary: HealthConnectSyncQueueSummary;
  lastResult: HealthConnectFlushResult | null;
  refresh: () => void;
  flush: (options?: { title?: string; manual?: boolean }) => Promise<void>;
}

export const useHealthConnectSyncStore: UseBoundStore<
  StoreApi<HealthConnectSyncQueueState>
>;
```

Not persisted (unlike `settingsStore`) — every field is derivable from storage on demand. It
exists so the foreground flush mounted in the root layout and the count rendered in settings
observe one status instead of two racing copies. `flush` is a no-op while
`status === 'flushing'` and always calls `refresh()` afterwards.

### New: `src/hooks/useHealthConnectSyncQueue.ts`

```ts
export function useHealthConnectSyncQueue(options?: {
  /** Mount the AppState listener. Exactly one call site should pass `true`. */
  autoFlushOnForeground?: boolean;
  title?: string;
}): {
  status: 'idle' | 'flushing';
  summary: HealthConnectSyncQueueSummary;
  lastResult: HealthConnectFlushResult | null;
  syncNow: () => void;
  refresh: () => void;
};
```

`refresh()` runs on mount. With `autoFlushOnForeground` the hook subscribes to `AppState`
and calls `flush({ manual: false })` on each transition into `'active'`, plus once on mount
(a cold start is a foreground); the subscription is removed on unmount. `syncNow()` calls
`flush({ manual: true })`, which is also the "immediately after permissions are granted"
path: it requests the permission and, on a grant, writes the whole backlog in the same pass.

### New: `src/components/HealthConnectSyncQueueCard.tsx`

```ts
export interface HealthConnectSyncQueueCardProps {
  summary: HealthConnectSyncQueueSummary;
  status: 'idle' | 'flushing';
  lastResult: HealthConnectFlushResult | null;
  onSyncNow: () => void;
}
```

Presentational only: no service or store import, every string through `t(...)`, tokens from
`@/theme`, and `accessibilityRole="button"` / label / hint /
`accessibilityState={{ disabled, busy }}` on the action, matching `HealthConnectStatusCard`.
Renders the pending count, the abandoned count when non-zero, the last pass's outcome, and a
"Sync now" button disabled while flushing or when `pending + abandoned === 0`.

### New i18n keys (`en.json` and `ja.json`, under `healthConnect`)

`queueTitle`, `queuePendingCount` (`%{count}`), `queueNothingPending`,
`queueAbandonedCount` (`%{count}`), `queueSyncNow`, `queueSyncNowHint`, `queueSyncing`,
`queueLastResultSynced` (`%{count}`), `queueLastResultFailed` (`%{count}`),
`queueSkippedUnavailable`, `queueSkippedPermissionDenied`, `syncStatusAbandoned`,
`syncReasonAbandoned`.

## Files Created

| File                                                          | Purpose                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/services/healthConnect/pendingSessionSync.ts`            | Pending selection, backoff/abandon policy, and the flush pass. Plain TS, no React. |
| `src/store/healthConnectSyncStore.ts`                         | Single observable queue status + summary shared by the layout flush and settings.  |
| `src/hooks/useHealthConnectSyncQueue.ts`                      | `AppState` foreground trigger and the `syncNow` adapter over the store.            |
| `src/components/HealthConnectSyncQueueCard.tsx`               | Settings UI: pending count, abandoned count, last outcome, "Sync now".             |
| `src/tests/services/healthConnect/pendingSessionSync.test.ts` | Selection, backoff, abandonment, partial-failure flush, no double-write.           |
| `src/tests/store/healthConnectSyncStore.test.ts`              | Summary refresh, concurrent-flush guard, status transitions.                       |
| `src/tests/hooks/useHealthConnectSyncQueue.test.ts`           | Foreground-edge flush, listener cleanup, `syncNow` passes `manual: true`.          |
| `src/tests/components/HealthConnectSyncQueueCard.test.tsx`    | Each count/status rendering plus the disabled/busy accessibility state.            |

## Files Modified

| File                                                                   | Change                                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/interfaces/healthConnect.ts`                                      | `'abandoned'` on `SessionHealthConnectSync.state` and `HealthConnectSyncState`; `failedAttempts`; the queue summary, skip reason, and flush result types. |
| `src/services/healthConnect/writeSessionToHealthConnect.ts`            | `promptForPermissions` / `manual` options; attempt counting and abandonment; non-prompting permission path.                                               |
| `src/hooks/useHealthConnectSessionSync.ts`                             | Derive `'abandoned'` from a persisted record; `retry()` passes `manual: true`; still no auto-attempt for a failed or abandoned session.                   |
| `src/components/HealthConnectSyncBadge.tsx`                            | Render the `'abandoned'` state (status text, reason text, Retry still offered).                                                                           |
| `src/app/_layout.tsx`                                                  | Mount `useHealthConnectSyncQueue({ autoFlushOnForeground: true })` — the one foreground trigger.                                                          |
| `src/app/settings.tsx`                                                 | Render `HealthConnectSyncQueueCard` under `HealthConnectStatusCard`, fed by the hook.                                                                     |
| `src/services/i18n/translations/en.json`                               | The new `healthConnect.queue*` and `*Abandoned` keys.                                                                                                     |
| `src/services/i18n/translations/ja.json`                               | The identical key set, translated.                                                                                                                        |
| `src/tests/services/healthConnect/writeSessionToHealthConnect.test.ts` | Cases for attempt counting, abandonment, the `manual` reset, and `promptForPermissions: false`.                                                           |
| `src/tests/hooks/useHealthConnectSessionSync.test.ts`                  | `'abandoned'` derivation and the `manual: true` retry.                                                                                                    |
| `src/tests/components/HealthConnectSyncBadge.test.tsx`                 | The `'abandoned'` rendering case.                                                                                                                         |
| `src/tests/app/settings.test.tsx`                                      | The queue card renders, and "Sync now" triggers a flush.                                                                                                  |

## Implementation Steps

1. Extend `src/interfaces/healthConnect.ts`: add `'abandoned'` to
   `SessionHealthConnectSync.state` and `HealthConnectSyncState`, add
   `failedAttempts?: number`, and append `HealthConnectSyncQueueSummary`,
   `HealthConnectFlushSkipReason`, and `HealthConnectFlushResult`. Run `pnpm typecheck` to
   surface every non-exhaustive `switch` the widening breaks.
2. Update `writeSessionToHealthConnect`: add the `promptForPermissions` (default `true`) and
   `manual` options; compute the carried / reset / incremented `failedAttempts` for each
   outcome; set `state: 'abandoned'` at `MAX_SYNC_ATTEMPTS`. Declare `MAX_SYNC_ATTEMPTS` in
   the writer and re-export it from `pendingSessionSync`, so the writer does not depend on
   the queue module.
3. Extend `src/tests/services/healthConnect/writeSessionToHealthConnect.test.ts`: a
   `'write-failed'` increments `failedAttempts`; the fifth failure persists `'abandoned'`;
   `'permission-denied'` and `'unavailable'` leave the counter untouched and keep
   `'failed'`; `manual: true` on an abandoned session resets to `0` and re-attempts;
   `promptForPermissions: false` with no grant resolves `'permission-denied'` and never
   calls `requestPermission`; an already-`'synced'` session is still short-circuited.
4. Implement `src/services/healthConnect/pendingSessionSync.ts` — `nextEligibleAt`,
   `selectPendingSessions`, `getSyncQueueSummary`, `flushPendingSessions`, the in-flight
   guard, and `reportError` on every caught failure.
5. Write `src/tests/services/healthConnect/pendingSessionSync.test.ts` against the real MMKV
   mock and a scripted `react-native-health-connect`: pending selection excludes synced and
   abandoned sessions and orders oldest-first; backoff gating for each `failedAttempts`
   value including the cap; `ignoreBackoff` and `includeAbandoned`; summary counts are
   disjoint; a flush where session 2 of 3 fails still writes session 3 and persists the
   per-session outcomes (partial-failure flush); a synced session in the index causes no
   `insertRecords` call (no double-write); a second concurrent `flushPendingSessions`
   returns `skipped: 'already-flushing'` and issues no extra write; unavailable and denied
   passes persist nothing; a missing session blob is skipped and reported; `maxSessions`
   reports the remainder as `deferred`.
6. Implement `src/store/healthConnectSyncStore.ts` and its test: `refresh()` recomputes the
   summary from storage; `flush()` sets `'flushing'` then returns to `'idle'`, stores
   `lastResult`, and is a no-op while already flushing.
7. Implement `src/hooks/useHealthConnectSyncQueue.ts` and its test with `AppState` mocked:
   an `'active'` edge from `'background'` triggers exactly one flush; a repeated `'active'`
   with no intervening background does not; the subscription is removed on unmount;
   `syncNow()` flushes with `manual: true`; without `autoFlushOnForeground` no listener is
   added.
8. Add the new keys to `en.json`, then the identical set to `ja.json`.
9. Implement `src/components/HealthConnectSyncQueueCard.tsx` and its test: the pending
   count, the nothing-pending copy, the abandoned line only when non-zero, the flushing
   state, each `skipped` reason's copy, and the button's disabled/busy accessibility state.
10. Handle `'abandoned'` in `src/hooks/useHealthConnectSessionSync.ts` and
    `src/components/HealthConnectSyncBadge.tsx`, and extend both tests.
11. Wire `src/app/_layout.tsx` with the foreground flush, passing
    `title: t('healthConnect.syncSessionTitle')`.
12. Wire `src/app/settings.tsx` to render the card from the hook (without
    `autoFlushOnForeground`), and extend `src/tests/app/settings.test.tsx`.
13. Manual device verification of the issue's acceptance criteria: with the Health Connect
    permission denied, record two sessions; grant the permission in system settings; return
    to the app and confirm both appear in Health Connect exactly once and the settings
    pending count drops to zero. Then force a write failure, and confirm the session is
    still in History, still openable, and still retryable from the badge.
14. `pnpm lint && pnpm typecheck && pnpm test`.

## Style & Conventions

- `CLAUDE.md` layering: `pendingSessionSync.ts` imports no React and nothing from `app/`,
  `components/`, `hooks/`, `store/`, or `theme/`; the card imports no service; the hook and
  the store are the only adapters between them.
- The issue's "no separate queue store to drift out of sync" is honored literally — the
  pending set is a derivation over `getSessionIndex()` + `getSession()`, and the only new
  persisted bytes are two fields on the session's existing `healthConnect` object.
- `'abandoned'` is added to the existing explicit unions rather than introduced as a boolean
  flag, per the "connection state is an explicit union" domain convention.
- Every Health Connect and storage call in the new code is wrapped and reported through
  `src/services/crashService.ts`, per the crash-logging cross-cutting requirement; a flush
  never rejects into a caller.
- No hardcoded user-facing string; every new key lands in both `en.json` and `ja.json`, as
  `src/tests/services/i18n/localeCoverage.test.ts` enforces.
- Full accessibility props on the one new interactive element, matching
  `HealthConnectStatusCard` and `HealthConnectSyncBadge`.
- Tests mirror source paths under `src/tests/`; the repo-root
  `__mocks__/react-native-health-connect.ts` and `__mocks__/react-native-mmkv.ts` are
  reused rather than adding inline `jest.mock()` factories.
- `AppState` is used directly from `react-native` inside a hook — a platform API in `hooks/`
  rather than `services/`, because the trigger is React lifecycle, not portable logic. The
  portable half (what to flush, when it is eligible, when to give up) stays in the service,
  per the reusables goal.

## Acceptance Criteria

- [ ] `selectPendingSessions` returns, oldest-first, exactly the sessions with no
      `healthConnect` field plus those with `state: 'failed'` whose backoff has elapsed; it
      never returns a `'synced'` session, and returns an `'abandoned'` one only with
      `includeAbandoned: true`.
- [ ] `nextEligibleAt` yields `0` for a never-attempted session and
      `attemptedAt + SYNC_BACKOFF_MS[min(failedAttempts, last index)]` otherwise, with the
      last entry acting as the cap.
- [ ] A `'write-failed'` outcome increments `failedAttempts`; reaching `MAX_SYNC_ATTEMPTS`
      persists `state: 'abandoned'`; an abandoned session is excluded from automatic passes
      and from `summary.pending`, and appears in `summary.abandoned`.
- [ ] `'unavailable'` and `'permission-denied'` outcomes leave `failedAttempts` unchanged,
      so an environmental failure can never abandon a session.
- [ ] A flush where one session's write fails still attempts every remaining eligible
      session, and the per-session persisted outcomes match (partial-failure flush).
- [ ] A flush over an index containing an already-`'synced'` session issues no
      `insertRecords` call for it (no double-write).
- [ ] A second `flushPendingSessions` call while one is in flight returns
      `skipped: 'already-flushing'` and performs no additional write.
- [ ] An automatic (`manual: false`) pass never calls `requestPermission`; a manual pass
      requests once and, on a grant, writes the whole backlog in that pass.
- [ ] When availability is not `'available'`, a pass returns `skipped: 'unavailable'` and
      persists nothing onto any session.
- [ ] `flushPendingSessions` never rejects, and every caught failure reaches `reportError`.
- [ ] `useHealthConnectSyncQueue({ autoFlushOnForeground: true })` flushes once on mount and
      once per transition into `'active'`, and removes its `AppState` subscription on
      unmount.
- [ ] Settings shows the pending count, shows the abandoned count when non-zero, disables
      "Sync now" while flushing and when nothing is pending, and exposes an
      `accessibilityState` reflecting both.
- [ ] The summary badge renders the `'abandoned'` state with its own copy and a Retry that
      resets the counter and re-attempts.
- [ ] On device: with the permission denied, two recorded sessions are both written on the
      next foreground after granting it, each appearing exactly once in Health Connect.
- [ ] On device: a failing write leaves the local session intact in History, openable, and
      retryable.
- [ ] `pnpm test` passes with `react-native-health-connect` fully mocked — no real native
      module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `src/tests/services/i18n/localeCoverage.test.ts` passes with the new keys in both
      locale files.

## Constraints

- **Non-goals:** no `WorkManager` / `expo-task-manager` / background job — foreground and
  manual flush only, per the issue's Notes; no `netinfo` dependency (Health Connect is
  on-device, so connectivity is irrelevant); no separate queue collection, key, or table; no
  sync state in the history list or `SessionIndexEntry`; no retry UI beyond the settings card
  and the existing summary badge; no notification when a flush fails; no Firebase or
  Firestore involvement; no reads from Health Connect; no `deleteSession` change.
- Exactly one component may pass `autoFlushOnForeground: true`, and the root layout is that
  component. The store's in-flight guard makes a second one harmless rather than duplicating
  writes, but it is still a wiring bug.
- `DEFAULT_FLUSH_LIMIT` bounds one pass. The remainder is not silently dropped: it is
  reported as `deferred`, still counted in `summary.pending`, and picked up by the next
  pass. A manual "Sync now" uses the same cap, so a very large backlog needs repeated taps —
  accepted at this scale (one session per workout).
- Writes are sequential by design. Parallel `insertRecords` calls against one Health Connect
  client have no ordering guarantee and no measurable benefit for a handful of records, and
  a parallel pass makes the partial-failure accounting far harder to reason about.
- Abandonment is a UI state, not a deletion: the local session, its samples, and its History
  entry are untouched, and a manual retry always remains available.
- `MAX_SYNC_ATTEMPTS` and the backoff schedule are wall-clock-based across app launches
  (compared against the persisted `attemptedAt`), not per-session in-memory counters. A user
  who foregrounds the app repeatedly cannot burn the retry budget faster than the schedule
  allows.
- Unresolved until implementation: whether `src/app/_layout.tsx` can call `useTranslation`
  before the i18n store hydrates. If the title lookup there proves order-dependent, the
  flush passes no `title` and `mapSessionToHealthRecords` simply omits it — the record is
  still valid.
- Android only, per `CLAUDE.md`. `AppState` is cross-platform but no iOS path is added or
  tested.
- No `app.json` or native change, so no `expo prebuild` or rebuild is required for this
  issue.
