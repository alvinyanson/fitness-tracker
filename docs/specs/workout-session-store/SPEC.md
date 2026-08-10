# Feature: Workout Session Store (Zustand) — Start/Pause/Resume/Stop + Keep-Awake

## Intent

A live workout has one authoritative, in-memory session state machine
(`idle | active | paused | stopped`) driving Start/Pause/Resume/Stop, with elapsed time
derived from timestamps (correct across re-renders and backgrounding), HR samples
appended only while `active`, a `reconnecting` flag that survives a BLE drop without
ending the session, and the screen kept awake for exactly the `active` span.

## Context

- **Problem statement:** [Issue #10](https://github.com/alvinyanson/fitness-tracker/issues/10)
  — `docs/specs.md` Milestone 1.2 requires "elapsed session timer with Start / Pause /
  Resume / Stop controls" and "graceful handling of disconnects mid-session (BLE
  connections drop often — show a reconnecting indicator rather than killing the
  session)" (`docs/specs.md:26,28`). No session state exists anywhere in the repo today —
  a repo-wide search for `workoutSession|SessionState|WorkoutSession` outside this spec
  returns nothing. The only existing zustand store, `src/store/settingsStore.ts`, is a
  persisted key-value settings store with no relevance to a timer/state-machine shape.
- **Current code:**
  - `src/store/settingsStore.ts` — the one existing precedent for a zustand store in this
    repo: a flat `create<State>()(...)` with actions colocated on the same interface as
    the data (no separate `interfaces/` type for `SettingsState` itself), wrapped in
    `persist` + the MMKV adapter. This spec follows the same colocation style for the
    store's action surface, but does **not** wrap it in `persist` — see Constraints.
  - `src/interfaces/ble.ts` — `BleConnectionSnapshot`, a discriminated union on `state`,
    is the repo's precedent for "explicit union, not booleans"
    (`CLAUDE.md`'s domain-conventions rule). `docs/specs/auto-reconnect-last-device/SPEC.md`
    already carved one **explicit, named exception** to that rule —
    `useDevicePairing`'s `isAutoReconnecting: boolean` — justified there as "the one
    narrow, named exception" for a concern genuinely orthogonal to the state union it sits
    beside. Issue #10 asks for the same shape again, explicitly: `reconnecting` as "a flag
    alongside the session status," not a fifth status value. This spec follows the
    issue's explicit instruction and treats it as a second instance of that
    already-established, narrowly-scoped exception, not a pattern to expand further.
  - `src/services/ble/heartRateMeasurement.ts` / `heartRateMonitor.ts` /
    `src/hooks/useHeartRateMonitor.ts` (`docs/specs/hr-measurement-notifications/SPEC.md`,
    merged) — produce a live `HeartRateSample` stream while `bleService`'s connection
    snapshot is `connected`, resetting to `null` on disconnect. That spec explicitly
    deferred "the elapsed session timer... session-level stat reduction... and the
    mid-session reconnecting indicator" to this issue. `useHeartRateMonitor` itself is
    reused as-is by this spec's hook layer; it is not modified.
  - `src/services/ble/bleService.ts` / `src/interfaces/ble.ts` — `BleConnectionSnapshot`
    (`idle | scanning | connecting | connected | disconnected | error`) is the only signal
    this feature has for "are we currently linked to the device." There is no
    BLE-layer concept of "reconnecting" today (`docs/specs/auto-reconnect-last-device/SPEC.md`
    added `isAutoReconnecting` only to the pairing-screen hook, scoped to the initial
    cold-start attempt) — this spec's `reconnecting` flag is a session-layer derivation
    (`disconnected` while a session is running), not a rename of that existing flag.
  - `src/services/formatDuration.ts` — pure `formatDuration(totalSeconds): string`
    already exists for rendering `mm:ss`/`h:mm:ss`. Reused as-is by whatever screen
    eventually renders elapsed time; this spec produces the millisecond value it will
    format, not new formatting logic.
  - `zustand` (`^5.0.14`) is **already a dependency** (added for `settingsStore.ts`) — the
    issue's "npx expo install zustand" checklist item is already satisfied; only
    `expo-keep-awake` is new.
- **User impact:** No screen exists yet to consume this store (the live workout screen is
  a separate, not-yet-filed issue per the HR-notifications spec's own note). This issue
  ships no user-visible UI. It ships the store, the pure elapsed-time calculation, and a
  thin React hook wiring keep-awake/BLE-reconnect-detection/HR-sample-ingestion to that
  store — the exact seam the not-yet-filed screen issue will render against.
- **Dependencies:** Depends on #9 (`docs/specs/hr-measurement-notifications/SPEC.md`,
  merged) for `HeartRateSample` and `useHeartRateMonitor`. Also builds on #6
  (`docs/specs/ble-connection-state-machine/SPEC.md`) for `BleConnectionSnapshot`/
  `bleService`, both merged. New package: `expo-keep-awake`.

## Data Model

New file `src/interfaces/session.ts`:

```ts
import type { HeartRateSample } from './heartRate';

/** Explicit union per CLAUDE.md's domain convention. */
export type WorkoutSessionStatus = 'idle' | 'active' | 'paused' | 'stopped';

/** The one payload `useWorkoutSessionStore` holds, minus its actions. */
export interface WorkoutSessionSnapshot {
  status: WorkoutSessionStatus;
  /** BLE drop in progress. */
  reconnecting: boolean;
  /** Set by `start()`. */
  startedAt: number | null;
  /** Set while `status === 'paused'`. */
  pausedAt: number | null;
  /** Sum of completed pause spans, ms. */
  totalPausedMs: number;
  /** Elapsed ms frozen at `stop()`. */
  stoppedElapsedMs: number | null;
  /** Appended only while `active`. */
  samples: HeartRateSample[];
}
```

`reconnecting` is a narrow, named exception to "explicit union over booleans" — the same
precedent `docs/specs/auto-reconnect-last-device/SPEC.md` already established for
`useDevicePairing`'s `isAutoReconnecting`: a concern orthogonal to `status`, not a fifth
status value, per issue #10's explicit "flag alongside the session status" wording.

No persistence: this store is in-memory only. `CLAUDE.md`'s "Sessions save locally the
moment the user hits Stop" refers to a separate, not-yet-filed session-history/storage
issue that will read this store's snapshot on `stop()` and write it to MMKV — this issue
produces that snapshot, it does not write it anywhere. See Constraints.

## Interfaces / API

### `src/services/session/sessionElapsed.ts` (pure, dependency-free)

```ts
import type { WorkoutSessionSnapshot } from '@/interfaces/session';

/** Elapsed active time in ms, excluding every paused span. */
export function getElapsedMs(
  session: WorkoutSessionSnapshot,
  now: number,
): number;
```

Pure function of the snapshot and an explicit `now` — never reads `Date.now()` itself, so
it is trivially testable and reusable by a future summary screen without re-deriving the
same arithmetic.

Behavior:

- `status === 'idle'` → `0`.
- `status === 'stopped'` → `session.stoppedElapsedMs ?? 0` (ignores `now`).
- `status === 'active'` → `now - session.startedAt! - session.totalPausedMs`.
- `status === 'paused'` → `session.pausedAt! - session.startedAt! - session.totalPausedMs`
  (frozen at the instant the pause began — time elapsed _during_ the current pause never
  counts, matching the issue's "pausing for 30s then resuming produces an elapsed time
  that excludes the paused span" acceptance criterion).
- `startedAt`/`pausedAt` are asserted non-null via the status guard above, not optional
  chaining — a `WorkoutSessionSnapshot` with `status: 'active'` and `startedAt: null` is
  an invariant violation the store's actions never produce (see below), so this function
  trusts the shape rather than silently returning `0` for it.

### `src/store/workoutSessionStore.ts`

```ts
import type { WorkoutSessionSnapshot } from '@/interfaces/session';
import type { HeartRateSample } from '@/interfaces/heartRate';

export interface WorkoutSessionState extends WorkoutSessionSnapshot {
  /** idle/stopped -> active. No-op from active/paused. */
  start(): void;
  /** active -> paused. No-op otherwise. */
  pause(): void;
  /** paused -> active. No-op otherwise. */
  resume(): void;
  /** active/paused -> stopped. No-op otherwise. */
  stop(): void;
  /** Appends only while `active`. */
  addSample(sample: HeartRateSample): void;
  /** No-op while idle/stopped. */
  setReconnecting(reconnecting: boolean): void;
  /** Forwards to `getElapsedMs(this, now)`. */
  getElapsedMs(now?: number): number;
}

export const useWorkoutSessionStore: UseBoundStore<
  StoreApi<WorkoutSessionState>
>;
```

- `start()` resets samples/timestamps for a fresh session. `resume()` folds the
  just-finished pause span into `totalPausedMs`. `stop()` freezes `stoppedElapsedMs` via
  `getElapsedMs`. `addSample`'s gate is the only thing enforcing "only while active" —
  `reconnecting` does not itself block appends; the lack of live samples during a drop is
  a natural consequence of no notifications arriving, not a store-level gate.
- Initial state: `{ status: 'idle', reconnecting: false, startedAt: null, pausedAt: null, totalPausedMs: 0, stoppedElapsedMs: null, samples: [] }`.
- Total-function guard style, matching `reduceBleConnectionState`'s existing convention
  (`src/services/ble/bleConnectionMachine.ts`): every action checks current `status`
  itself and no-ops (returns/`set` nothing) when called from a status it doesn't apply
  to, rather than throwing. The store is not modeled as a separate pure reducer file
  (unlike `bleConnectionMachine.ts`) because there is exactly one consumer of these
  transitions (this store) and no second caller needs the transition table in isolation —
  colocating the guards in each zustand action matches `settingsStore.ts`'s existing
  single-file precedent for this repo's stores.
- `addSample` performs no validation of the sample itself (that already happened in
  `parseHeartRateMeasurement`, per `docs/specs/hr-measurement-notifications/SPEC.md`) — it
  only gates on `status`.
- No `persist` middleware: this store is intentionally ephemeral, per Constraints.

### `src/hooks/useWorkoutSession.ts`

```ts
export interface UseWorkoutSessionResult {
  status: WorkoutSessionStatus;
  reconnecting: boolean;
  elapsedMs: number;
  sampleCount: number;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export function useWorkoutSession(): UseWorkoutSessionResult;
```

App-specific wiring this hook owns (none of it lives in the store, per `CLAUDE.md`'s
"generic logic in the middle, app-specific wiring at the edges"):

1. **Ticking.** While `status === 'active'`, a `setInterval(..., 1000)` inside a
   `useEffect` bumps a local re-render tick so `elapsedMs` (computed via
   `getElapsedMs(store-snapshot, Date.now())` on every render) advances live. No interval
   while `paused`/`idle`/`stopped` — the value is already static in those statuses per
   `getElapsedMs`'s own definition, so a paused screen shows a genuinely frozen number,
   not one that happens to stop visually.
2. **Keep-awake.** A `useEffect` keyed on `status === 'active'` calls
   `activateKeepAwakeAsync()` (from `expo-keep-awake`) on entry and
   `deactivateKeepAwake()` in its cleanup — the cleanup fires both on the
   active→(paused|stopped) transition _and_ on unmount, satisfying "release on stop/unmount"
   with one effect rather than two separate call sites. Both are the package's imperative
   functions, not the `useKeepAwake()` hook — a hook can't be called conditionally from
   inside another hook's effect, and gating on `status` (not "is this screen mounted") is
   the actual requirement here.
3. **Reconnect detection.** A `useEffect` subscribing to `bleService` the same way
   `useDevicePairing`/`useHeartRateMonitor` already do
   (`useSyncExternalStore(bleService.subscribe, bleService.getSnapshot)`) calls
   `setReconnecting(connection.state === 'disconnected')` whenever `status` is `active` or
   `paused`; it never calls `bleService.connect()` itself — reconnection is
   `bleService`'s/`useDevicePairing`'s existing job (auto-reconnect-on-mount and manual
   reconnect are both out of this hook's scope). This is a pure derivation, not a new
   reconnect mechanism.
4. **Sample ingestion.** A `useEffect` active only while `status === 'active'` calls
   `subscribeToHeartRate` (`src/services/ble/heartRateMonitor.ts`) and forwards every
   decoded sample straight to the store's `addSample` — the store's own status guard is
   what actually enforces "only while active," so this effect doesn't duplicate that
   check; it simply never subscribes outside `active`, which also means no notification
   arrives (and nothing is dropped) while `paused`. Unsubscribes on
   pause/stop/disconnect/unmount, mirroring `useHeartRateMonitor`'s existing
   subscribe/unsubscribe lifecycle.

## Files Created

| File                                                | Purpose                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/interfaces/session.ts`                         | `WorkoutSessionStatus` / `WorkoutSessionSnapshot`.                                                          |
| `src/services/session/sessionElapsed.ts`            | Pure `getElapsedMs` — timestamp-based elapsed calculation, no React/native imports.                         |
| `src/store/workoutSessionStore.ts`                  | The zustand session state machine and its actions.                                                          |
| `src/hooks/useWorkoutSession.ts`                    | Wires keep-awake, BLE reconnect detection, and HR sample ingestion to the store.                            |
| `src/tests/services/session/sessionElapsed.test.ts` | Unit tests for every `status` branch of `getElapsedMs`, no mocks.                                           |
| `src/tests/store/workoutSessionStore.test.ts`       | State-machine tests: every transition, every no-op case, disconnect-during-active, pause-during-disconnect. |
| `src/tests/hooks/useWorkoutSession.test.ts`         | Hook tests: keep-awake activate/deactivate timing, reconnect flag wiring, sample ingestion gating, ticking. |

## Files Modified

| File             | Change                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `package.json`   | Add `expo-keep-awake` (via `npx expo install expo-keep-awake`). `zustand` is already present. |
| `pnpm-lock.yaml` | Regenerated by the above install.                                                             |

## Implementation Steps

1. `npx expo install expo-keep-awake`; confirm the installed version against
   `https://docs.expo.dev/versions/v56.0.0/sdk/keep-awake/` for SDK 56 (Android-only usage
   needs no `app.json` change — the package has no Android permission or config-plugin
   requirement per its docs).
2. Add `src/interfaces/session.ts` (`WorkoutSessionStatus`, `WorkoutSessionSnapshot`).
3. Implement `src/services/session/sessionElapsed.ts`'s `getElapsedMs` per the contract
   above.
4. Write `src/tests/services/session/sessionElapsed.test.ts`: one case per `status`
   branch (`idle` → 0; `stopped` → `stoppedElapsedMs`, including `null` → 0; `active` at a
   given `now`; `paused` ignoring any `now` value passed, always returning the frozen
   `pausedAt`-based figure; a scenario combining a completed pause span _and_ a currently
   active span to confirm `totalPausedMs` is excluded correctly).
5. Implement `src/store/workoutSessionStore.ts` per the contract above: initial state,
   `start`/`pause`/`resume`/`stop`/`addSample`/`setReconnecting`/`getElapsedMs`, each
   action's status guard.
6. Write `src/tests/store/workoutSessionStore.test.ts` covering: `start()` from `idle`
   and from `stopped` (fresh-session reset of samples/timestamps/`reconnecting`);
   `start()` no-ops from `active`/`paused`; `pause()`/`resume()` happy path and their
   no-op cases from every other status; `stop()` freezing `stoppedElapsedMs` from both
   `active` and `paused`, and no-op from `idle`/`stopped`; `addSample()` appends only
   while `active` and is silently dropped in every other status (assert the buffer length
   is unchanged, no throw); `setReconnecting()` sets the flag while `active`/`paused` and
   no-ops from `idle`/`stopped`; **disconnect-during-active** — `reconnecting: true` while
   `status` stays `active`, `addSample` calls during that window are dropped (simulating
   "no notifications arrive"), and `stop()` still works normally afterward;
   **pause-during-disconnect** — `reconnecting: true` set while already `paused`, then
   `resume()` still computes the correct elapsed time excluding the pause span,
   independent of the flag. Mock `Date.now` via `jest.spyOn(Date, 'now')` for
   deterministic timestamps (no fake timers needed — the store never calls `setInterval`
   itself).
7. Implement `src/hooks/useWorkoutSession.ts` per the contract above, reusing
   `bleService.subscribe`/`getSnapshot` and `subscribeToHeartRate` exactly as
   `useDevicePairing.ts`/`useHeartRateMonitor.ts` already do.
8. Write `src/tests/hooks/useWorkoutSession.test.ts` with
   `@testing-library/react-native`'s `renderHook`/`act`, mocking `expo-keep-awake`
   (`jest.mock('expo-keep-awake', ...)` if `jest-expo`'s bundled mock doesn't already
   cover the two imperative exports used) and the BLE mock's existing
   `__connectOutcome`/`__emitNotification`/disconnect helpers: `start()` calls
   `activateKeepAwakeAsync`; `stop()` and unmount both call `deactivateKeepAwake`, exactly
   once each (no double-release); a BLE disconnect while `active` sets `reconnecting`
   true without changing `status`, and a reconnect clears it; HR notifications reach the
   store's sample buffer only while `active`, confirmed by asserting `sampleCount` via the
   hook's return value across an active→pause→resume cycle; `elapsedMs` advances across a
   mocked 1s interval tick while `active` and stays constant while `paused`.
9. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Style & Conventions

- `sessionElapsed.ts` has zero React/native imports and takes `now` as an explicit
  parameter rather than calling `Date.now()` itself, matching `CLAUDE.md`'s "Highest-value
  coverage is the pure logic in `services/`" testing guidance and the existing
  `heartRateMeasurement.ts`/`formatDuration.ts` precedent for dependency-free, portable
  functions in `services/`.
- `workoutSessionStore.ts` follows `settingsStore.ts`'s existing single-file precedent
  (data + actions on one interface, guards inline in each action) rather than splitting
  out a standalone reducer file like `bleConnectionMachine.ts` — justified above under
  Interfaces/API since this store has exactly one consumer of its transition logic.
- `reconnecting` as a boolean beside the `status` union is a second, narrowly-scoped
  instance of the exception `docs/specs/auto-reconnect-last-device/SPEC.md` already
  established for `isAutoReconnecting` — not a general relaxation of "explicit union over
  booleans." No third boolean is added anywhere in this spec.
- `useWorkoutSession.ts` reuses the exact `useSyncExternalStore(bleService.subscribe,
bleService.getSnapshot)` pattern already used by `useDevicePairing.ts` and
  `useHeartRateMonitor.ts`, per those hooks' own established convention — no second way of
  observing BLE connection state is introduced.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior spec's
  convention in this repo.
- Per `CLAUDE.md`'s "Build for portability," `sessionElapsed.ts` and
  `workoutSessionStore.ts`'s core state machine have no BLE/keep-awake dependency at all —
  only `useWorkoutSession.ts` (the app-specific wiring layer) imports `expo-keep-awake`
  and the BLE/HR services, so the store and its elapsed-time math would lift into another
  project unchanged.

## Acceptance Criteria

- [ ] `start()` from `idle` or `stopped` begins a fresh session (`status: 'active'`,
      `samples: []`, `reconnecting: false`, `totalPausedMs: 0`, `stoppedElapsedMs: null`);
      it no-ops from `active`/`paused`.
- [ ] Pausing for 30s then resuming produces an elapsed time (`getElapsedMs`) that
      excludes the paused span, verified with mocked `Date.now` values 30000ms apart.
- [ ] `addSample()` appends only while `status === 'active'`; calls made while
      `idle`/`paused`/`stopped` are silently dropped with no error and no buffer growth.
- [ ] A simulated BLE disconnect while `active` (via `useWorkoutSession`) sets
      `reconnecting: true`, leaves `status` at `active` and the elapsed timer running
      (unaffected by `reconnecting`), and produces zero new samples until reconnect, at
      which point samples resume and `reconnecting` returns to `false`.
- [ ] Pausing while already disconnected (`reconnecting: true`) and then resuming still
      excludes the paused span from elapsed time — the two conditions compose
      independently.
- [ ] `useWorkoutSession`'s keep-awake effect calls `activateKeepAwakeAsync()` exactly
      once per active-entry and `deactivateKeepAwake()` exactly once on both stop and
      unmount — no double-activate on a re-render while still `active`, no leaked
      keep-awake after unmount.
- [ ] `pnpm test` passes, including every new suite, with `react-native-ble-plx` and
      `expo-keep-awake` mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — `expo-keep-awake`'s Android/iOS split is irrelevant
  here since this app has no iOS build target at all.
- **No persistence in this issue.** The store is in-memory/ephemeral by design; writing a
  stopped session's snapshot to MMKV or Health Connect is `CLAUDE.md`'s "Sessions save
  locally the moment the user hits Stop" requirement, but that's a separate, not-yet-filed
  storage issue that will _read_ this store's snapshot — this spec does not add a
  `persist` middleware, an MMKV key, or a save call anywhere.
- **No live workout screen.** Per the HR-notifications spec's own note, the screen that
  renders Start/Pause/Resume/Stop buttons and the live BPM/elapsed/reconnecting UI is a
  separate, not-yet-filed issue. This spec ships the store and the hook it will consume,
  not the screen.
- **No session-level stat reduction (avg/max/min BPM) or calorie math** — explicitly
  out of scope per `docs/specs.md` Milestone 1.2's remaining bullets and CLAUDE.md; this
  issue's `samples` array is the raw input a later, not-yet-filed issue will reduce.
- **`reconnecting` is derived, not a new reconnect mechanism.** `useWorkoutSession` never
  calls `bleService.connect()`; actual reconnection stays owned by
  `bleService`/`useDevicePairing`'s existing auto-reconnect/manual-reconnect paths
  (`docs/specs/auto-reconnect-last-device/SPEC.md`). This hook only reflects the
  connection snapshot into the session's `reconnecting` flag.
- **One session at a time.** There is no concept of session history, multiple concurrent
  sessions, or resuming a session across an app restart — `start()` from `stopped`
  always begins an unrelated new session, discarding the previous one's in-memory
  snapshot (which the not-yet-filed persistence issue is expected to have already saved
  before the next `start()`).
- Functional verification of real screen-sleep behavior and real BLE drops needs a device
  and `pnpm android` (dev client); unit/hook tests here cover the state machine, elapsed
  math, and wiring logic against mocks only, per `CLAUDE.md`'s "Expo Go does not work
  here" and existing BLE-mocking testing conventions.
