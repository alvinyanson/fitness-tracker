# Feature: Session Summary Screen — Persisted on Stop, Rendered from Storage

## Intent

The instant Stop is pressed, the finished session (timing, `computeSessionStats` reduction,
raw HR samples) is written to MMKV under a versioned shape, before any navigation;
`summary/[id]` then renders that one persisted record — identically whether reached
straight from the live workout screen or later from history — with an explicit "no heart
rate recorded" state and a confirmed delete action.

## Context

- **Problem statement:** [Issue #13](https://github.com/alvinyanson/fitness-tracker/issues/13)
  — `docs/specs.md:30-34` (Milestone 1.3) and `CLAUDE.md`'s hard constraint "Sessions save
  locally the moment the user hits Stop... before any sync or health-store write is
  attempted." Today, nothing persists a session. `src/app/summary/[id].tsx` is still the
  scaffold stub from `docs/specs/expo-router-src-scaffold/SPEC.md` (renders whatever `id`
  string it's given, no storage read). `src/app/workout.tsx` calls `stop()` and, on the
  `status === 'stopped'` transition, does `router.replace('/summary/current')` — a literal
  placeholder segment, explicitly flagged as temporary in
  `docs/specs/live-workout-screen/SPEC.md`'s own Constraints ("this spec does not attempt
  to design that scheme now"). No session ever survives a Stop today: `useWorkoutSession`'s
  `stop()` only flips the in-memory `workoutSessionStore` to `stopped`; nothing reads that
  snapshot and nothing writes to MMKV.
- **Current code:**
  - `src/services/session/sessionStats.ts` (`docs/specs/session-stats-service/SPEC.md`,
    merged) — pure `computeSessionStats(session, now?)` already reduces a
    `WorkoutSessionSnapshot` into `SessionStats` (`durationMs`, `avgHr`/`maxHr`/`minHr`
    each `number | null`, `sampleCount`, `rawSampleCount`), with garbage-sample filtering
    and a well-defined all-`null` result for zero valid samples. This spec calls it
    exactly once, at persist time, and does not re-derive any of that math.
  - `src/store/workoutSessionStore.ts` / `src/hooks/useWorkoutSession.ts`
    (`docs/specs/workout-session-store/SPEC.md`, merged) — `stop()` freezes
    `stoppedElapsedMs` via `getElapsedMs` and leaves `samples` untouched (the full
    accumulated buffer). Per that spec's own Constraints, this is deliberate: "the
    not-yet-filed persistence issue is expected to have already saved [the session] before
    the next `start()`." This issue is that persistence issue.
  - `src/services/storage/mmkvStorage.ts` / `deviceStorage.ts`
    (`docs/specs/mmkv-storage-layer/SPEC.md`, merged) — the generic
    `getItem`/`setItem`/`removeItem` wrapper and the one existing domain-specific call
    site. That spec explicitly scoped session-history storage out: "no consumer yet...
    would be speculative scope beyond this issue." This issue is that consumer, and
    follows the same thin-wrapper-over-the-generic-wrapper shape as `deviceStorage.ts`.
  - `src/app/workout.tsx` — beyond the store's own stats, this screen independently
    computes its own live `avgBpmDisplay`/`maxBpmDisplay`/`caloriesDisplay` inline (a
    70kg-assumed MET/HR calorie estimate) for its own 2×2 live stat grid. That logic is
    pre-existing, scoped to the **live** in-progress display, and is left untouched here —
    this issue only changes `workout.tsx`'s Stop→navigate wiring (the effect that currently
    fires `router.replace('/summary/current')`), not its live stat cards or its calorie
    estimate.
  - `src/app/history.tsx` — still the scaffold stub, links to the literal
    `/summary/demo` (no session with that id will ever exist once this issue ships).
    Building the real history list (`docs/specs.md` item 4) is a separate, not-yet-filed
    issue; out of scope here. The stub link now exercises this issue's new "session not
    found" state, which is an acceptable, expected outcome, not a regression to fix.
  - `src/components/StatCard.tsx`, `HeaderBar.tsx`, `BottomNavBar.tsx` — existing
    presentational components this screen reuses as-is, matching `workout.tsx`'s established
    per-screen composition (`HeaderBar` + scrollable content + `BottomNavBar`).
  - `docs/ui-reference/session_summary.png` — reference only, per `CLAUDE.md`. It shows a
    2×2 stat grid (AVG/MAX/MIN HR + a 4th "EST. KCAL" card), an HR-trend line chart, and
    **"Save Workout" / "Discard"** buttons. Two elements conflict with hard project
    constraints and are deliberately not built: (1) calorie estimation is Milestone 3 scope
    (`docs/specs.md:84`) — the 4th grid slot is repurposed for **sample count** instead,
    which is in this issue's explicit scope and needs no new math; (2) a "Save" choice is
    incompatible with "sessions save the moment Stop is pressed" — there is nothing left to
    save by the time this screen renders, so only a **Delete** action (with confirmation)
    is built, matching the issue's own scope bullet. The HR-trend chart needs
    `react-native-svg`, a Milestone 2 package (`CLAUDE.md`'s tech-stack list) — not added
    here.
  - `src/app/workout.tsx`'s hardware-back confirm flow already establishes this repo's one
    `Alert.alert`-based confirmation pattern (`workout.discardTitle`/`discardMessage`/
    `discardCancel`/`discardConfirm`); this spec's delete confirmation reuses that same
    shape with its own `summary.*` keys, not a new confirmation mechanism.
- **User impact:** Stopping a workout now actually keeps the session: force-quitting right
  after Stop no longer loses it, and the summary screen becomes a real detail view instead
  of an inert stub. Users get an explicit "no heart rate recorded" message instead of blank
  or `NaN` metrics when no HR device was paired, and can delete a session they don't want to
  keep.
- **Dependencies:** Depends on #4 (`docs/specs/mmkv-storage-layer/SPEC.md`, merged) and #12
  (`docs/specs/session-stats-service/SPEC.md`, merged), both satisfied. No new package.

## Data Model

New additions to `src/interfaces/session.ts` (alongside the existing
`WorkoutSessionSnapshot`/`SessionStats`):

```ts
/** Schema version of the persisted shape; bump only on a breaking change. */
export const SESSION_SCHEMA_VERSION = 1;

/** One completed, persisted workout — the full record, including raw samples. */
export interface PersistedSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  /** `String(startedAt)`; unique because only one session runs at a time. */
  id: string;
  startedAt: number;
  endedAt: number;
  stats: SessionStats;
  samples: HeartRateSample[];
}

/** Lightweight per-session summary for a future history list — no sample series. */
export interface SessionIndexEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  avgHr: number | null;
}
```

- **Id scheme:** `id = String(startedAt)` (the session's start timestamp, ms epoch). No
  `uuid`/`nanoid` dependency exists in this repo today and none is added — the store's own
  "one session at a time" invariant (`docs/specs/workout-session-store/SPEC.md`'s
  Constraints) already guarantees `startedAt` values never collide in practice, and a
  numeric-string id sorts chronologically for free.
- **Versioning:** `schemaVersion` is a literal `1` today. Per the issue's "extend without a
  destructive migration" requirement, a later milestone adding a field (Health Connect sync
  flag, GPS route, calories) does so by adding an **optional** field to `PersistedSession`
  and reading `schemaVersion` to decide whether to backfill a default — this issue does not
  build that migration path, only the version tag it depends on.
- **Two-tier storage, not one blob:** a full `PersistedSession` (with its potentially large
  `samples` array) is written under a per-session key; a separate, small `SessionIndexEntry[]`
  is written under one index key. This is the "session index" CLAUDE.md's Storage section
  names as one of MMKV's specific responsibilities, and it means a future history list can
  read/sort/scan sessions without deserializing every session's full sample series — the
  exact seam `CLAUDE.md`'s Storage section describes for the eventual `expo-sqlite` move of
  time-series data in Milestone 3 (only the per-session record's `samples` field would move;
  the index shape is unaffected).
- **No change to `WorkoutSessionSnapshot`/`SessionStats`.** This issue only adds new,
  independent types; it does not touch the live in-memory session shape.

## Interfaces / API

### `src/services/storage/sessionHistoryStorage.ts` (new; thin, mirrors `deviceStorage.ts`)

```ts
import type { PersistedSession, SessionIndexEntry } from '@/interfaces/session';

export function saveSession(session: PersistedSession): void;
export function getSession(id: string): PersistedSession | null;
/** Newest first (descending `startedAt`). */
export function getSessionIndex(): SessionIndexEntry[];
export function deleteSession(id: string): void;
```

- Keys: `@fitness_tracker/session/<id>` (one per full record) and
  `@fitness_tracker/session-index` (one array, all entries). Both go through the existing
  generic `getItem`/`setItem`/`removeItem` wrapper — no second storage engine, no direct
  MMKV import here.
- `saveSession(session)`: writes the full record to its per-session key, then reads the
  current index, removes any existing entry with the same `id` (defensive — a real
  double-save never happens per "one session at a time," but keeps this function
  idempotent), appends `{ id, startedAt, endedAt, durationMs: stats.durationMs, avgHr:
stats.avgHr }`, sorts by `startedAt` descending, and writes the index back. Two writes,
  synchronous, both complete before this function returns (MMKV's `set` is synchronous) —
  the property the "force-quit right after Stop" acceptance criterion depends on.
- `getSession(id)`: `getItem<PersistedSession>(`@fitness_tracker/session/${id}`)`; `null`
  if absent or corrupt (the underlying wrapper already treats corrupt JSON as absent).
- `getSessionIndex()`: `getItem<SessionIndexEntry[]>('@fitness_tracker/session-index') ?? []`.
- `deleteSession(id)`: `removeItem` on the per-session key, then rewrites the index with
  that `id` filtered out. No-op (no throw) if `id` isn't present in either place.
- No React, no knowledge of `WorkoutSessionSnapshot` — this module only knows the persisted
  shape, matching `deviceStorage.ts`'s existing "thin wrapper, no session-machine
  awareness" precedent.

### `src/services/session/persistSession.ts` (new, pure composition — the one write path)

```ts
import type {
  WorkoutSessionSnapshot,
  PersistedSession,
} from '@/interfaces/session';

/** Caller must pass a session already in `'stopped'` status. */
export function persistCompletedSession(
  session: WorkoutSessionSnapshot,
): PersistedSession;
```

- Reduces a stopped session via `computeSessionStats` and writes it to storage. The caller
  (the hook) calls this only once, right after `workoutSessionStore.stop()` freezes the
  snapshot.
- Computes `computeSessionStats(session)` (no `now` override needed — a `stopped` session's
  duration ignores `now` per `sessionElapsed.ts`'s own contract, so this call is
  deterministic regardless of when it runs).
- Builds `{ schemaVersion: SESSION_SCHEMA_VERSION, id: String(session.startedAt), startedAt:
session.startedAt!, endedAt: session.startedAt! + stats.durationMs, stats, samples:
session.samples }`, calls `saveSession(record)`, and returns `record`.
- `session.startedAt` is asserted non-null the same way `sessionElapsed.ts` already trusts
  the snapshot's invariants for a non-`idle` status — a `stopped` session always has a
  `startedAt` (set by `start()`, never cleared before the next `start()`).
- Lives under `services/session/` (not `services/storage/`) because its job is the
  session-domain reduction step; it depends on both `sessionStats.ts` (same directory) and
  `sessionHistoryStorage.ts` (a services/ sibling), which is an ordinary services-to-services
  dependency, not a layering violation — `CLAUDE.md`'s layering contract restricts what may
  depend on `services/`, not what `services/` submodules may depend on each other.
- No React import. This is the one and only place `saveSession` is called from — no other
  call site writes a `PersistedSession`.

### `src/hooks/useWorkoutSession.ts` (extended)

```ts
export interface UseWorkoutSessionResult {
  status: WorkoutSessionStatus;
  reconnecting: boolean;
  elapsedMs: number;
  sampleCount: number;
  currentBpm: number | null;
  rollingAverageBpm: number | null;
  /** The id just written by the most recent stop() call; null until the first stop. */
  lastCompletedSessionId: string | null;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}
```

- `stop` is now a wrapping function, not a direct forward of the store's `stop` action:
  1. Read `useWorkoutSessionStore.getState().status`. If it is neither `active` nor
     `paused`, call the store's `stop()` (preserves its existing no-op behavior for an
     already-idle/-stopped call) and return — nothing to persist.
  2. Otherwise call the store's `stop()` (freezes `stoppedElapsedMs`), then read
     `useWorkoutSessionStore.getState()` again — now `status: 'stopped'`, `samples` intact.
  3. Call `persistCompletedSession(stoppedSnapshot)`, and set `lastCompletedSessionId` (a
     local `useState`) to the returned record's `id`.
  - This ordering (store-freeze first, then read-and-persist) means `persistCompletedSession`
    always sees the exact same `stoppedElapsedMs` the rest of the app would read from the
    store — no separate `now` capture that could drift by the few milliseconds between the
    button press and this code running.
  - Persistence is synchronous (MMKV), so by the time `stop()` returns, the record is
    already durably on disk — satisfying "before any navigation" even though navigation
    itself happens in a `workout.tsx` effect that runs after this render commits.
- No other field or action changes.

## Files Created

| File                                                       | Purpose                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/services/storage/sessionHistoryStorage.ts`            | CRUD over the per-session and index MMKV keys.                                               |
| `src/services/session/persistSession.ts`                   | Pure `persistCompletedSession`: stats reduction + storage write, the one write path.         |
| `src/app/summary/[id].tsx` (rewritten, not scaffold)       | Renders one persisted session from storage; delete action; not-found state.                  |
| `src/tests/services/storage/sessionHistoryStorage.test.ts` | Unit tests: save/get/delete round-trip, index ordering, corrupt/missing id handling.         |
| `src/tests/services/session/persistSession.test.ts`        | Unit tests: record shape, id derivation, zero-sample session, storage call.                  |
| `src/tests/app/summary/[id].test.tsx`                      | Screen tests: renders a stored session, no-HR state, delete confirm/cancel, not-found state. |

## Files Modified

| File                                        | Change                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/interfaces/session.ts`                 | Add `SESSION_SCHEMA_VERSION`, `PersistedSession`, `SessionIndexEntry`.                                                   |
| `src/hooks/useWorkoutSession.ts`            | Wrap `stop()` to persist via `persistCompletedSession`; add `lastCompletedSessionId` to the result.                      |
| `src/tests/hooks/useWorkoutSession.test.ts` | Add cases: stop persists a record, `lastCompletedSessionId` is set, a no-op stop (idle/stopped) persists nothing.        |
| `src/app/workout.tsx`                       | Stop→navigate effect now guards on `lastCompletedSessionId` and navigates to `` `/summary/${lastCompletedSessionId}` ``. |
| `src/tests/app/workout.test.tsx`            | Update the existing stop-navigates assertion from the literal `/summary/current` to the persisted id.                    |
| `src/services/i18n/translations/en.json`    | Add `summary.*` keys (see Implementation Steps).                                                                         |
| `src/services/i18n/translations/ja.json`    | Japanese translations for the same keys, keeping `localeCoverage.test.ts` passing.                                       |

## Implementation Steps

1. Add `SESSION_SCHEMA_VERSION`, `PersistedSession`, `SessionIndexEntry` to
   `src/interfaces/session.ts` per the Data Model above.
2. Implement `src/services/storage/sessionHistoryStorage.ts`:
   `saveSession`/`getSession`/`getSessionIndex`/`deleteSession` per the contract above,
   built on the existing `getItem`/`setItem`/`removeItem` wrapper.
3. Write `src/tests/services/storage/sessionHistoryStorage.test.ts` (mirrors
   `deviceStorage.test.ts`'s `beforeEach(() => createMMKV().clearAll())` style): save then
   get returns an equivalent record; `getSession` on a missing id returns `null`;
   `getSessionIndex` returns entries newest-first across several saves; `deleteSession`
   removes both the per-session key and its index entry; deleting a non-existent id is a
   no-op, no throw.
4. Implement `src/services/session/persistSession.ts`'s `persistCompletedSession` per the
   contract above.
5. Write `src/tests/services/session/persistSession.test.ts` (no mocks needed for
   `computeSessionStats`; mock only `saveSession` from `sessionHistoryStorage` via
   `jest.mock`, or clear MMKV in `beforeEach` and assert through `getSession` — prefer the
   latter, matching this repo's existing preference for exercising the real storage mock
   over a jest.mock'd module, per `sessionHistoryStorage.test.ts`'s own approach): a normal
   stopped session with samples produces a record with the correct
   `id`/`startedAt`/`endedAt`/`stats`; a session with zero/no-HR samples produces
   `stats.avgHr === null` and still persists successfully; `endedAt - startedAt ===
stats.durationMs` when there's no pause (paused sessions are already covered by
   `sessionStats.test.ts`'s own duration cases — this test isn't re-verifying pause
   arithmetic, only that `endedAt` is derived consistently from it).
6. Extend `src/hooks/useWorkoutSession.ts`: wrap `stop`, add `lastCompletedSessionId` state
   and field, per the contract above.
7. Extend `src/tests/hooks/useWorkoutSession.test.ts`: `stop()` while `active`/`paused`
   calls `persistCompletedSession` (or, exercised end-to-end, leaves a real record behind
   in the mocked MMKV store) and sets `lastCompletedSessionId` to `String(startedAt)`; a
   `stop()` call while already `idle`/`stopped` leaves `lastCompletedSessionId` at its
   previous value (`null` on a fresh hook) and writes nothing new.
8. Update `src/app/workout.tsx`'s stop→navigate effect: depend on
   `[status, lastCompletedSessionId]`, guard `status === 'stopped' &&
lastCompletedSessionId`, navigate to ``router.replace(`/summary/${lastCompletedSessionId}`)``.
9. Update `src/tests/app/workout.test.tsx`'s existing navigation assertion (currently
   asserting `/summary/current`) to assert `mockReplace` is called with
   `` `/summary/${expectedId}` `` (derive the expected id from the same `startedAt` the test's
   `start()` call produces, mocking `Date.now()` if the existing test doesn't already).
10. Add `summary.*` translation keys to `en.json` (and Japanese equivalents to `ja.json`):
    `summary.title` (keep, e.g. "Session Summary"), `summary.notFoundTitle`,
    `summary.notFoundMessage`, `summary.backToHistory` (keep), `summary.avgHr`,
    `summary.maxHr`, `summary.minHr`, `summary.samples`, `summary.noHeartRate` (the
    explicit no-HR-recorded copy), `summary.deleteAction`, `summary.deleteTitle`,
    `summary.deleteMessage`, `summary.deleteCancel`, `summary.deleteConfirm`. Run
    `pnpm test -- localeCoverage` to confirm parity.
11. Rewrite `src/app/summary/[id].tsx`:
    - Read `id` via `useLocalSearchParams<{ id: string }>()`; call `getSession(id)` once
      (e.g. via `useMemo(() => getSession(id), [id])` — storage reads are synchronous, no
      loading state needed).
    - `session === null` → not-found branch: `HeaderBar` + centered
      `summary.notFoundTitle`/`notFoundMessage` + a `Link` back to `/history`, `BottomNavBar`.
    - `session !== null` → `HeaderBar` (`showSignalIcon={false}`, no device badge — this
      isn't a live BLE screen) + scrollable content:
      - Date/time: `formatDate(new Date(session.startedAt), settingsStore.language, {
dateStyle: 'medium', timeStyle: 'short' })`.
      - Duration: `formatDuration(Math.floor(session.stats.durationMs / 1000))`, styled
        like `workout.tsx`'s existing large timer text.
      - 2×2 `StatCard` grid: AVG HR / MAX HR / MIN HR (each `stats.*Hr ?? '—'`, `unit="bpm"`
        only when non-null, matching `workout.tsx`'s existing `unit`-omission-on-dash
        convention) and SAMPLES (`stats.sampleCount`, no unit) — the 4th grid slot, replacing
        the mockup's calorie card per the Context section's documented deviation.
      - When `session.stats.avgHr === null`: render `summary.noHeartRate` as an explicit
        text note below the grid (not a blank/dash-only state) — satisfies "a session
        recorded with no HR device renders without errors or blank metrics."
      - Delete: an outlined pill button (`summary.deleteAction`), mirroring
        `workout.tsx`'s `secondaryPillButton` styling, that calls `Alert.alert` with
        `summary.deleteTitle`/`deleteMessage`/`deleteCancel`/(destructive)`deleteConfirm`;
        confirming calls `deleteSession(id)` then `router.replace('/history')`.
      - `BottomNavBar currentRoute="history"` (matches its own existing
        `pathname.includes('summary')` → `history` fallback derivation, made explicit here
        the same way `workout.tsx` passes `currentRoute="workout"` explicitly).
12. Write `src/tests/app/summary/[id].test.tsx` with `@testing-library/react-native`,
    mocking `expo-router`'s `useLocalSearchParams`/`router` the same way
    `workout.test.tsx` mocks `expo-router`, and pre-seeding the mocked MMKV store (via
    `saveSession`) before each render: renders duration/avg/max/min/sample-count/date for a
    seeded session; renders `summary.noHeartRate` for a session whose `stats.avgHr` is
    `null`; renders the not-found branch for an unseeded id; delete flow — pressing Delete
    shows the confirm alert, cancelling leaves the record in storage (`getSession` still
    returns it) and does not navigate, confirming calls `deleteSession` (verified via
    `getSession(id) === null` afterward) and navigates to `/history`.
13. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`.
14. Manual/device verification (per Acceptance Criteria — needs `pnpm android`): complete a
    short session with a real/mocked HR broadcaster, confirm the summary screen appears
    with correct stats; force-quit the app immediately after pressing Stop and relaunch,
    confirm the session still opens from the persisted id; complete a session with no HR
    device paired and confirm the no-HR-recorded state renders without error.

## Style & Conventions

- `sessionHistoryStorage.ts` follows `deviceStorage.ts`'s exact shape: thin, no React, no
  session-machine awareness, keys namespaced `@fitness_tracker/`, built only on the
  existing generic `getItem`/`setItem`/`removeItem` wrapper — no second storage engine.
- `persistCompletedSession` has zero React/native imports and is the single write path,
  matching this repo's "one authority per computation" precedent (`sessionElapsed.ts` for
  duration, `sessionStats.ts` for the HR reduction, this file for the persisted record).
- `summary/[id].tsx` follows `workout.tsx`'s established per-screen composition
  (`HeaderBar` + `ScrollView` + `BottomNavBar`, `useTranslation()` for every string, a
  single trailing `StyleSheet.create` built from `@/theme` tokens only, no hardcoded
  hex/size/radius, no `fontFamily` per `CLAUDE.md`'s "fonts are pending" rule).
- The delete confirmation reuses `workout.tsx`'s existing `Alert.alert` pattern verbatim in
  shape (title/message/cancel/destructive-confirm) — no new confirmation abstraction for a
  second call site.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior spec's
  convention in this repo.
- One-line comments only in code; rationale lives in this SPEC's prose, per this project's
  comment-density convention.

## Acceptance Criteria

- [ ] Pressing Stop during an active/paused session writes a `PersistedSession` to MMKV
      (verifiable via `getSession(id)`) before `workout.tsx` navigates anywhere.
- [ ] Force-quitting immediately after Stop and relaunching still shows the session when
      its `summary/[id]` route is opened (manual/device verification — the underlying
      guarantee, MMKV's synchronous write completing before navigation, is unit-tested).
- [ ] Opening `summary/[id]` for the same id from history renders identically to the
      post-workout view — the screen has no branch that depends on how it was reached,
      only on the `id` param and storage contents.
- [ ] A session with no HR samples (`stats.avgHr === null`) renders duration, sample count,
      and date/time without error, plus the explicit `summary.noHeartRate` message — never
      blank fields or `NaN`.
- [ ] Delete shows a confirmation; cancelling leaves the session and stays on the screen;
      confirming removes it from storage and navigates to `/history`.
- [ ] Opening `summary/[id]` for an id with no stored session renders the not-found state
      instead of crashing.
- [ ] `getSessionIndex()` returns entries newest-first and reflects every save/delete.
- [ ] `pnpm test` passes, including every new/modified suite, with `react-native-mmkv`
      mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — nothing platform-specific is introduced beyond what
  the app already targets.
- **No HR-trend chart.** The mockup's line chart needs `react-native-svg`, a Milestone 2
  package (`CLAUDE.md`'s tech-stack notes); not added in this Milestone 1 issue.
- **No calorie field.** MET/HR-adjusted calorie estimation stays Milestone 3 scope
  (`docs/specs.md:84`); `PersistedSession`/`SessionStats` gain no `calories` field here,
  and the mockup's 4th grid card is repurposed for sample count instead.
- **No "Save" choice.** Per `CLAUDE.md`'s hard constraint, the session is already persisted
  by the time this screen can render — only Delete (with confirmation) is built, not the
  mockup's Save/Discard pair.
- **No history-list screen.** `docs/specs.md` item 4 (list past sessions, tap into
  summary) is a separate, not-yet-filed issue; `history.tsx` is untouched beyond becoming a
  valid entry point into a now-real `summary/[id]` route.
- **No Health Connect / sync flags.** `PersistedSession`'s `schemaVersion` exists so a
  later milestone can add those fields non-destructively; this issue does not add or
  reserve any such field now.
- **`persistCompletedSession` assumes `status === 'stopped'` on input.** It is only ever
  called from `useWorkoutSession`'s `stop()` wrapper, immediately after the store's own
  `stop()` action freezes the snapshot; it is not a general-purpose "persist any session"
  entry point and performs no independent status validation beyond what `computeSessionStats`
  already tolerates.
- **One record per `startedAt`.** Restarting a session always produces a new `startedAt`
  (per the store's existing "always a fresh session" `start()` behavior), so id collisions
  are not handled beyond `saveSession`'s defensive index de-dup — this is not a general
  conflict-resolution scheme.
- Functional verification of the force-quit/relaunch guarantee and of manual HR-device-less
  sessions needs a device and `pnpm android` (dev client); unit/component tests here cover
  the storage round-trip, the persistence composition, and the screen's rendering/delete
  logic against the mocked MMKV module only, per `CLAUDE.md`'s "Expo Go does not work here."
