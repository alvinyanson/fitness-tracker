# Feature: Explicit Connection-State Union in `bleService`

## Intent

`src/services/ble/bleService.ts` owns the entire BLE scan/connect/disconnect
lifecycle behind a single reducer-driven state machine that emits the explicit
`idle | scanning | connecting | connected | disconnected | error` union (error
carrying a typed cause) — no caller, present or future, derives connection
state from booleans, and every "awkward" transition (scan/connect timeout,
connect rejection, an unexpected drop, the adapter going off) resolves to a
documented next state with guaranteed listener/timer cleanup.

## Context

- **Problem statement:** GitHub issue #6 asks for this as a "refactor" of an
  existing `src/services/ble/bleService.ts` (~135 lines). That file does not
  exist — confirmed via directory listing: `src/services/ble/` currently
  contains only `blePermissionGate.ts`, `blePermissions.ts`, and
  `bluetoothAdapter.ts` (all from `docs/specs/android-ble-permission-gate/`).
  No scan/connect logic, no heart-rate characteristic handling, and no
  `src/hooks/useBleHeartRate.ts` exist anywhere in the repo — the
  permission-gate spec's own Context section says so explicitly ("no
  scan/connect flow exists anywhere in the repo yet"). This is greenfield
  work, not a refactor of existing code, same situation as issue #5 before it.
  `docs/specs.md` Milestone 1.1 (lines 17–19) requires exactly this: scan for
  the Heart Rate Service (0x180D), connect, and handle
  "scanning / connecting / connected / disconnected / error" as an explicit
  state machine, "same shape as the weather app's detecting-location /
  fetching-weather / error flow."
- **Current code:** `src/interfaces/ble.ts` already holds
  `BlePermissionStatus`, `BluetoothAdapterStatus`, `BleGateStatus` — the
  connection-state union is a new, distinct concept in the same file (the
  permission-gate spec flagged this composition explicitly: gate must be
  `'ready'` before connection state leaves `'idle'`, but they are not the same
  enum). `src/services/ble/bluetoothAdapter.ts` already wraps
  `BleManager.state()` for a one-shot adapter check; this feature adds the
  first **live** adapter-state subscription (`onStateChange`) so a connection
  in progress can react to the user switching Bluetooth off. The BLE mock
  (`__mocks__/react-native-ble-plx.ts`, built in
  `docs/specs/jest-rntl-harness-ble-mock/`) already scripts scan results,
  connect success/failure, notifications, and disconnects — it has no
  `onStateChange` or `cancelDeviceConnection` yet and needs both.
- **User impact:** None yet — this issue ships no screen. It is the service
  layer a not-yet-filed pairing-screen issue will consume. The user-visible
  payoff (scan list, connect button, reconnecting indicator) lands when that
  UI issue wires a hook to `bleService.subscribe()`.
- **Dependencies:** Issue #6 lists "depends on the test harness issue for the
  ble-plx mock" (closed — `docs/specs/jest-rntl-harness-ble-mock/`) and
  "depends on #3" (same harness; already merged, mock file present). No new
  package — `react-native-ble-plx@^3.5.1` (devDependency) is already
  installed. `expo-keep-awake` and any UI work are out of scope here.

### Reference code supplied with the issue — context only, not implemented as shown

The user attached a `useBleHeartRate` hook, a `BleService` class,
`parseHeartRate`, and a flat `ConnectionState` union in `src/types/ble.ts`.
Per the pattern this repo already established in the permission-gate spec,
this is reused selectively:

- **Types location:** the reference puts `ConnectionState` in
  `src/types/ble.ts`. This repo's convention (`CLAUDE.md`: "`interfaces/` (not
  `types/`) is the home for shared TypeScript types", already followed by
  `src/interfaces/ble.ts`, `storage.ts`, `i18n.ts`) wins — the new types land
  in `src/interfaces/ble.ts`, not a new `types/` directory.
- **State shape:** the reference's `ConnectionState` is a flat string union
  with no error payload. Issue #6's own scope line — "the error variant
  carrying a cause" — asks for more than that flat union gives. This spec
  keeps the flat union as `BleConnectionState` (the simple string every
  `switch`/comparison uses) but adds a discriminated `BleConnectionSnapshot`
  around it that carries the cause/device/reason payload per state. See Data
  Model.
- **Heart-rate monitoring is out of scope.** The reference's
  `subscribeToHeartRate` and `parseHeartRate` are HR-characteristic-specific.
  This issue is scoped to the connection-state union itself; `bleService`
  exposes one generic `monitorCharacteristic()` primitive (so the "remove
  notification subscriptions" cleanup guarantee in the issue's scope has
  something concrete to clean up) but does not parse the Heart Rate
  Measurement payload or know about UUID `0x2A37`. HR parsing consumes this
  primitive in a separate, not-yet-filed issue — `heartRateParser.ts` does not
  exist in this repo yet either.
- **No hook in this issue.** The reference's `useBleHeartRate` mixes scan
  state, connect state, HR value, and last-paired-device persistence into one
  React hook. `CLAUDE.md`'s layering contract (`services/` has no React
  import; `hooks/` adapts a service to React) and this issue's own scope
  (`bleService`, unit tests over the mock, no component/hook mentioned) both
  point to keeping this issue at the service layer. A thin `useBleConnection`
  hook that just subscribes to `bleService` and re-renders is exactly the
  kind of wrapper a future pairing-screen issue adds — writing it now with no
  consumer would be dead code.
- **`device out of range` vs. the "disconnect is routine" rule:** the
  reference doesn't model this case at all. `CLAUDE.md`'s domain conventions
  say "A disconnect never kills an active session... BLE drops are routine."
  Treating an unexpected out-of-range drop as an `error` state would
  contradict that. This spec resolves it as: an unsolicited disconnect while
  `connected` (out of range, GATT timeout, anything not initiated by calling
  `bleService.disconnect()`) transitions to `disconnected` with
  `reason: 'unexpected'` — a defined, non-error terminal state, exactly
  matching the "routine" framing. `error` is reserved for adapter-off and the
  service's own scan/connect timeouts/rejections, where no channel exists to
  even attempt reconnecting until the user acts. This is a deliberate reading
  of "device out of range" from the issue's scope list, not a literal `error`
  cause — flagged here per the skill's instruction to distinguish confirmed
  fact from designed decision.

## Data Model

All additions to `src/interfaces/ble.ts` (extending the existing
`BlePermissionStatus` / `BluetoothAdapterStatus` / `BleGateStatus` file):

```ts
/** A device seen during a scan, not yet connected. */
export interface DiscoveredDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

/** A device the app has successfully connected to at least once this session. */
export interface PairedDevice {
  id: string;
  name: string | null;
}

/**
 * The simple state label every caller switches on. `CLAUDE.md`'s domain
 * convention: every new async flow follows this shape, not booleans.
 */
export type BleConnectionState =
  'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Why a `disconnected` snapshot happened. Both are routine, per CLAUDE.md — neither is an error. */
export type BleDisconnectReason = 'userInitiated' | 'unexpected';

/**
 * Why an `error` snapshot happened. Reserved for outcomes with no
 * reconnect-automatically path — the adapter is off, or the service's own
 * scan/connect attempt didn't resolve in time or was rejected outright.
 */
export type BleConnectionErrorCause =
  | 'scanTimeout'
  | 'connectTimeout'
  | 'connectRejected'
  | 'adapterOff'
  | 'unknown';

/**
 * The one payload `bleService.subscribe()` ever emits. Discriminated on
 * `state` so a consumer narrows to the fields that exist for that state
 * instead of checking optional booleans.
 */
export type BleConnectionSnapshot =
  | { state: 'idle' }
  | { state: 'scanning' }
  | { state: 'connecting'; deviceId: string }
  | { state: 'connected'; device: PairedDevice }
  | { state: 'disconnected'; device: PairedDevice; reason: BleDisconnectReason }
  | { state: 'error'; cause: BleConnectionErrorCause; message: string };
```

- No persistence and no database change. `bleService` holds one in-memory
  `BleConnectionSnapshot`; nothing here is written to MMKV. Last-paired-device
  persistence already exists (`deviceStorage.ts`) and is unaffected — a future
  hook decides when to read/write it, `bleService` doesn't.
- Relationship to `BleGateStatus`: unchanged from the permission-gate spec —
  the gate must resolve `'ready'` before anything calls `bleService.startScan`
  or `.connect()`. `bleService` does not re-check permissions or adapter state
  before scanning/connecting (that's the gate's job, already done upstream);
  it only reacts to the adapter going off _after_ a connection attempt has
  started, via `error: 'adapterOff'`.
- Invariant: `BleConnectionSnapshot.state` is always exactly what the last
  event applied through the reducer produced — there is no code path that
  sets a snapshot field without going through
  `reduceBleConnectionState` (see Interfaces / API). This is the concrete
  mechanism behind "no component derives connection state from booleans."

## Interfaces / API

Two new service modules under `src/services/ble/`, both React-free per
`CLAUDE.md`'s layering contract.

### `src/services/ble/bleConnectionMachine.ts` — the reducer

```ts
export type BleConnectionEvent =
  | { type: 'scanStarted' }
  | { type: 'scanStopped' }
  | { type: 'scanTimedOut' }
  | { type: 'connectRequested'; deviceId: string }
  | { type: 'connectSucceeded'; device: PairedDevice }
  | { type: 'connectTimedOut' }
  | { type: 'connectRejected'; message: string }
  | { type: 'disconnectRequested' }
  | { type: 'disconnected'; reason: BleDisconnectReason; device: PairedDevice }
  | { type: 'adapterPoweredOff' }
  | { type: 'reset' };

export function reduceBleConnectionState(
  current: BleConnectionSnapshot,
  event: BleConnectionEvent,
): BleConnectionSnapshot;
```

- Pure function, no I/O, no `BleManager` import — testable with zero mocks.
  `BleConnectionEvent` is an internal wiring detail between `bleService` and
  this reducer, not re-exported from `interfaces/`: nothing outside
  `bleService.ts` ever constructs one.
- **Total function.** An event that doesn't apply to the current state (e.g.
  `connectSucceeded` while `idle`) returns `current` unchanged — this must
  never throw, since it is also the safety net if `bleService` ever calls it
  out of order.
- Transition table (this is the contract the unit tests assert row-by-row):

  | Current          | Event                 | Next                               |
  | ---------------- | --------------------- | ---------------------------------- |
  | `idle`           | `scanStarted`         | `scanning`                         |
  | `scanning`       | `scanStopped`         | `idle`                             |
  | `scanning`       | `scanTimedOut`        | `error` (`scanTimeout`)            |
  | `scanning`       | `connectRequested`    | `connecting`                       |
  | `idle`           | `connectRequested`    | `connecting` (auto-reconnect path) |
  | `disconnected`   | `connectRequested`    | `connecting`                       |
  | `error`          | `connectRequested`    | `connecting`                       |
  | `connecting`     | `connectSucceeded`    | `connected`                        |
  | `connecting`     | `connectTimedOut`     | `error` (`connectTimeout`)         |
  | `connecting`     | `connectRejected`     | `error` (`connectRejected`)        |
  | `connecting`     | `adapterPoweredOff`   | `error` (`adapterOff`)             |
  | `connected`      | `disconnectRequested` | `disconnected` (`userInitiated`)   |
  | `connected`      | `disconnected`        | `disconnected` (`unexpected`)      |
  | `connected`      | `adapterPoweredOff`   | `error` (`adapterOff`)             |
  | `scanning`       | `adapterPoweredOff`   | `error` (`adapterOff`)             |
  | `disconnected`   | `reset`               | `idle`                             |
  | `error`          | `reset`               | `idle`                             |
  | _any other pair_ | —                     | unchanged (no-op)                  |

### `src/services/ble/bleService.ts` — the emitter

```ts
export interface BleServiceOptions {
  scanTimeoutMs?: number; // default 15000
  connectTimeoutMs?: number; // default 10000
}

export class BleService {
  constructor(options?: BleServiceOptions);

  getSnapshot(): BleConnectionSnapshot;
  subscribe(listener: (snapshot: BleConnectionSnapshot) => void): () => void;

  startScan(onDeviceFound: (device: DiscoveredDevice) => void): void;
  stopScan(): void;

  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;

  monitorCharacteristic(
    serviceUUID: string,
    characteristicUUID: string,
    onValue: (base64Value: string) => void,
    onError: (error: Error) => void,
  ): () => void; // returns an unsubscribe fn

  destroy(): void;
}

export const bleService: BleService;
```

- **`subscribe`** is the _only_ way a caller observes state — it returns an
  unsubscribe function (React `useEffect`-cleanup shaped, for the hook that
  will consume this). Every internal transition calls
  `reduceBleConnectionState` exactly once and then notifies every current
  subscriber with the new snapshot; a listener that throws is caught and
  logged (`console.error`) so one bad subscriber can't break the others'
  notification pass.
- **`startScan`** calls `manager.startDeviceScan(null, { allowDuplicates: false }, ...)`,
  applies `scanStarted`, and arms a `setTimeout(scanTimeoutMs)` that, if not
  cleared first, calls `stopScan()` internally and applies `scanTimedOut`.
  Found devices are surfaced only via the `onDeviceFound` callback — they are
  not part of `BleConnectionSnapshot` (a discovered-devices list is scan-UI
  state, not connection state; a future hook owns that list the same way
  `useBleHeartRate`'s reference did with its own `devices` state).
- **`stopScan`** calls `manager.stopDeviceScan()`, clears the scan timer if
  pending, and applies `scanStopped` — but only if the current state is
  `scanning` (matches the reducer table; calling it from any other state is a
  no-op at the service level too, not just inert at the reducer level, so it
  never calls `stopDeviceScan()` needlessly).
- **`connect(deviceId)`**: applies `connectRequested`, stops any in-progress
  scan first, then races `manager.connectToDevice(deviceId, { autoConnect: false })`
  against a `connectTimeoutMs` timer:
  - Manager promise resolves first → `device.discoverAllServicesAndCharacteristics()`,
    register `device.onDisconnected(...)` (routes to the `disconnected` event,
    `reason: 'unexpected'`, unless `disconnect()` was the one that triggered
    it), apply `connectSucceeded`.
  - Manager promise rejects first → apply `connectRejected` with
    `error.message`.
  - Timer fires first → call `manager.cancelDeviceConnection(deviceId)` (best
    effort; failures are swallowed the same way the existing `disconnect()`
    reference code does) and apply `connectTimedOut`. This is the "cancel
    in-flight connects" cleanup guarantee from the issue's scope.
  - Whichever branch resolves first, the timer is always cleared so it can't
    also fire afterward.
- **`disconnect()`**: no-ops if not `connected`. Otherwise removes the
  characteristic-notification subscription(s) registered since connecting,
  calls `manager.cancelDeviceConnection(deviceId)`, and applies
  `disconnectRequested`. A flag distinguishes this explicit path from the
  device's own `onDisconnected` firing afterward as a side effect of the
  cancel, so the reducer only ever sees one of `disconnectRequested` /
  `disconnected` per user-initiated disconnect, never both.
- **Adapter-off mid-connection**: the constructor subscribes once to
  `manager.onStateChange(state => ..., true)`. Whenever that callback reports
  anything other than `State.PoweredOn` while the current state is
  `connecting`, `connected`, or `scanning`, the service tears down whatever is
  in flight (cancel connect / stop scan) and applies `adapterPoweredOff`. This
  subscription is created once in the constructor and removed only in
  `destroy()` — it is not re-created per scan/connect cycle, so it cannot
  itself leak across cycles.
- **`monitorCharacteristic`** is a thin, HR-agnostic pass-through to
  `device.monitorCharacteristicForService(...)`, returning an unsubscribe
  function that calls `.remove()` on the underlying `Subscription`. It throws
  synchronously if called while not `connected` (programmer error — a future
  hook is expected to call this only after observing a `connected` snapshot).
- **`destroy()`**: the full teardown — clears both timers if pending, calls
  `stopScan()` if scanning, calls `disconnect()` if connected, removes the
  adapter-state subscription, clears the subscriber set, and resets the
  internal snapshot to `{ state: 'idle' }`. This is what a future hook calls
  from its `useEffect` cleanup on unmount/navigation-away — the issue's
  "stop scanning on unmount/navigation away" guarantee has no consumer yet
  (no screen exists), so it is verified at the service level only in this
  issue; wiring it to actual unmount is the pairing-screen issue's job.

## Files Created

| File                                                  | Purpose                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/ble/bleConnectionMachine.ts`            | Pure reducer (`reduceBleConnectionState`) + the internal `BleConnectionEvent` union.                                                                                                                                                                                                              |
| `src/services/ble/bleService.ts`                      | Stateful emitter wrapping `BleManager`: scan/connect/disconnect, timers, adapter-state watch, cleanup, `subscribe()`.                                                                                                                                                                             |
| `src/tests/services/ble/bleConnectionMachine.test.ts` | Full transition-table test, one case per row above plus a handful of no-op pairs. No `BleManager` mock needed.                                                                                                                                                                                    |
| `src/tests/services/ble/bleService.test.ts`           | Integration tests against `__mocks__/react-native-ble-plx.ts`: scan timeout, connect timeout, connect rejected, adapter-off mid-scan and mid-connect, explicit disconnect vs. unexpected disconnect, repeated scan/connect/disconnect cycles with no duplicate notification/disconnect callbacks. |

## Files Modified

| File                                | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/interfaces/ble.ts`             | Add `DiscoveredDevice`, `PairedDevice`, `BleConnectionState`, `BleDisconnectReason`, `BleConnectionErrorCause`, `BleConnectionSnapshot` (existing gate types untouched).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `__mocks__/react-native-ble-plx.ts` | Add `BleManager.onStateChange(listener, emitCurrentState?)` wired to the existing `__setAdapterState`/`sharedAdapterState`; add `BleManager.cancelDeviceConnection(deviceId)` that resolves and fires that device's registered disconnect listener(s) with no error (mirrors real ble-plx: a cancelled connection triggers `onDisconnected`); extend the scriptable `connectOutcomeState` type from `'success' \| { error: Error }` to also accept `'pending'`, where `connectToDevice` returns a promise that never resolves on its own — the only way to exercise `connectTimedOut` deterministically under Jest fake timers. |

## Implementation Steps

1. Extend `src/interfaces/ble.ts` with the six new types/interfaces in Data
   Model.
2. Extend `__mocks__/react-native-ble-plx.ts`: `onStateChange`,
   `cancelDeviceConnection`, and the `'pending'` connect-outcome state. Add or
   update `src/tests/services/react-native-ble-plx.test.ts` cases only if the
   new mock surface itself needs direct coverage beyond what
   `bleService.test.ts` exercises indirectly.
3. Implement `src/services/ble/bleConnectionMachine.ts`.
4. Write `src/tests/services/ble/bleConnectionMachine.test.ts` against the
   full transition table, including at least two no-op pairs (e.g.
   `connectSucceeded` while `idle`; `scanStopped` while `connected`).
5. Implement `src/services/ble/bleService.ts` per the contract above, using
   `jest.useFakeTimers()`-compatible `setTimeout`/`clearTimeout` (no
   `setInterval`, no reliance on real wall-clock delay).
6. Write `src/tests/services/ble/bleService.test.ts`:
   - scan with no scripted results, advance fake timers past
     `scanTimeoutMs` → snapshot is `error`/`scanTimeout`, `stopDeviceScan`
     was called exactly once.
   - `connect()` scripted `'pending'`, advance past `connectTimeoutMs` →
     snapshot is `error`/`connectTimeout`, `cancelDeviceConnection` was
     called for that device id.
   - `connect()` scripted `{ error }` → snapshot is `error`/`connectRejected`
     with that error's message.
   - `connect()` scripted `'success'` → snapshot is `connected`; then
     `manager.__setAdapterState(State.PoweredOff)` → snapshot is
     `error`/`adapterOff`.
   - scanning, then `manager.__setAdapterState(State.PoweredOff)` mid-scan →
     `error`/`adapterOff`, scan stopped.
   - `connect()` success then `disconnect()` → snapshot is
     `disconnected`/`userInitiated`; separately, `connect()` success then
     `manager.__emitDisconnect()` (no explicit `disconnect()` call) →
     `disconnected`/`unexpected`.
   - Run connect → monitor a characteristic → disconnect three times on the
     same device id, then call `manager.__emitNotification(...)` once and
     assert the currently-registered `onValue` callback fires exactly once
     (proves no stale subscription from an earlier cycle survived) —
     satisfies the issue's "no duplicate notification callbacks after 3
     cycles" acceptance criterion. Repeat the same shape for
     `__emitDisconnect()` against the subscriber count passed to
     `bleService.subscribe()`.
   - `destroy()` while scanning/connected clears timers, removes the
     adapter-state subscription (assert a `BleManager.onStateChange`
     unsubscribe spy was called), and resets `getSnapshot()` to `idle`.
7. Run verification commands (below).

## Style & Conventions

- Layering: `bleConnectionMachine.ts` and `bleService.ts` have no React
  import and import nothing from `app/`, `components/`, `hooks/`, `store/`,
  or `theme/`, per `CLAUDE.md`. `bleService.ts`'s native-module use of
  `react-native-ble-plx` inside a service adapter is explicitly sanctioned by
  `CLAUDE.md` ("Native-module access inside a service adapter is intentional
  — the rule is no React imports, not no native imports").
  `bleConnectionMachine.ts` imports nothing native at all — it is pure logic,
  matching the highest-value-coverage guidance in `CLAUDE.md`'s Testing
  section.
- New shared types live in `src/interfaces/ble.ts`, not a `src/types/`
  directory, per `CLAUDE.md` and this repo's existing precedent
  (`src/interfaces/storage.ts`, `src/interfaces/i18n.ts`).
- Test files mirror source paths 1:1 under `src/tests/`, matching
  `src/tests/services/ble/blePermissionGate.test.ts`'s existing convention.
- The BLE mock stays the single repo-root `__mocks__/react-native-ble-plx.ts`
  file, extended rather than duplicated — same approach the permission-gate
  spec used when it added `state()`/`__setAdapterState`.
- Explicit-union-over-booleans is the connection-state convention
  `CLAUDE.md` names directly ("Connection state is an explicit union, not
  booleans. Every new async flow follows this shape") — this spec is that
  convention's own defining implementation, not just a consumer of it.
- No timers left running past a test: every `bleService.test.ts` case that
  arms a timer either lets it fire under fake timers or calls `destroy()`
  before the test ends, so `jest --detectOpenHandles` stays clean.

## Acceptance Criteria

- [ ] Every state in `idle | scanning | connecting | connected | disconnected
    | error` is reached by at least one `bleService.test.ts` case, and each
      transition matches the documented table exactly (see Implementation
      Steps for the specific cases).
- [ ] `reduceBleConnectionState` has a passing test for every row of the
      transition table, plus at least two no-op (unchanged-state) pairs.
- [ ] Scan timeout, connect timeout, connect rejection, and adapter-off (both
      mid-scan and mid-connect) each resolve to `error` with the documented
      `cause`, and each stops/cancels the in-flight operation
      (`stopDeviceScan` / `cancelDeviceConnection` called, asserted via the
      mock).
- [ ] An unexpected disconnect (device out of range, or any `onDisconnected`
      not preceded by a `disconnect()` call) produces
      `disconnected`/`unexpected`, never `error`.
- [ ] An explicit `disconnect()` call produces exactly one
      `disconnected`/`userInitiated` snapshot notification — not that plus a
      second `unexpected` one from the resulting `onDisconnected` firing.
- [ ] Three consecutive scan → connect → monitor → disconnect cycles on the
      same device id leave exactly one live notification callback and no
      duplicate disconnect-listener firing (issue's explicit acceptance
      criterion).
- [ ] `destroy()` clears all timers, removes the adapter-state subscription,
      and resets `getSnapshot()` to `{ state: 'idle' }` regardless of which
      state it was called from.
- [ ] `pnpm test` passes, including all new/updated suites, with
      `react-native-ble-plx` mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — nothing here is platform-conditional
  because `react-native-ble-plx`'s JS API is already platform-agnostic; no
  new platform branch is introduced.
- **No scan-result UI, no pairing screen, no hook.** `src/app/index.tsx`
  keeps rendering its current `BlePermissionGateView`/stub-links content
  unchanged. A `useBleConnection` (or similarly named) hook that subscribes
  to `bleService` is separate, not-yet-filed work.
- **No heart-rate characteristic parsing.** `monitorCharacteristic` is
  generic; UUID `0x180D`/`0x2A37` handling and `parseHeartRate`-equivalent
  logic are a separate, not-yet-filed issue that will call this primitive.
- **No last-paired-device persistence changes.** `deviceStorage.ts` already
  exists and is untouched; deciding _when_ to call `bleService.connect()`
  with a saved device id (auto-reconnect on launch) is the future hook's
  concern, not this service's.
- **No live discovered-devices list in the state union.** Scan results reach
  callers via `startScan`'s `onDeviceFound` callback only; `DiscoveredDevice`
  exists in `interfaces/ble.ts` for that callback's shape, not as a
  `BleConnectionSnapshot` field.
- **Default timeouts (`scanTimeoutMs: 15000`, `connectTimeoutMs: 10000`) are a
  starting point**, not a spec'd product requirement — `docs/specs.md` does
  not name specific values. They are constructor-overridable for tests
  (jest fake timers) and can be tuned later without changing the state
  machine's shape.
- This issue does not touch `app.json` or any native permission — the
  permission/adapter-gate work is already done (`android-ble-permission-gate`
  spec); this feature only adds a _live_ adapter-state subscription on top of
  the existing one-shot `getBluetoothAdapterStatus()`, reusing the same
  `BleManager` API surface.
