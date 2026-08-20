# Feature: BLE Connect/Scan Lifecycle Hardening

## Intent

`BleService` can no longer strand the UI in `connecting`, no longer leaves an
orphaned GATT link behind a cancelled or timed-out connect, reports native scan
failures instead of swallowing them, and is torn down by app code when the app
tree unmounts — each of the four behaviours pinned by a regression test.

## Context

- **Problem statement:** GitHub issue #70 collects four defects found in the M1
  BLE audit that PR #69 deliberately left untouched to stay behaviour-neutral.
  All four live in `src/services/ble/bleService.ts`. Verified against the current
  file:
  - **P2 — connect timeout does not cover service discovery.**
    `raceConnectWithTimeout()` calls `this.clearConnectTimer()` as soon as the
    race resolves, then `connect()` awaits
    `device.discoverAllServicesAndCharacteristics()` with **no timer armed**. A
    device that links but stalls in discovery leaves the snapshot at
    `{ state: 'connecting' }` indefinitely; `src/app/index.tsx:49-63` renders
    `t('pairing.connecting')` forever and the only escape is `cancelConnect()`
    (the Cancel affordance) or killing the app.
  - **P3 — cancelled-then-successful connect leaks a GATT link.**
    `cancelConnect()` calls `safeCancelDeviceConnection(manager, deviceId)` and
    dispatches `connectCancelled` while `manager.connectToDevice()` is still in
    flight, so the cancel runs _before_ the link exists. When the connect later
    resolves, `connect()` hits `if (this.snapshot.state !== 'connecting')
return;` and drops the `Device` without cancelling it. The same drop point
    covers the timeout case: once `CONNECT_TIMEOUT` rejects the race, the
    underlying `connectToDevice()` promise is unobserved and its `Device` is
    never cancelled either.
  - **P10 — scan errors are swallowed.** The `startDeviceScan` callback opens
    with `if (error || !device) return;`. A native scan failure is
    indistinguishable from an empty room and surfaces only 15 s later as
    `cause: 'scanTimeout'`; nothing reaches `crashService`.
  - **P8 — `destroy()` is never called from app code.** `resetBleService()` and
    `.destroy()` appear only in tests. Additionally `destroy()` itself never
    calls `manager.destroy()`, so the native `BleManager` outlives the service
    even when a consumer does tear it down.
- **Current code:** `BleService` (singleton via `getBleService()`) drives the
  reducer in `src/services/ble/bleConnectionMachine.ts`, the snapshot union in
  `src/interfaces/ble.ts`, and the throw-safe native wrappers in
  `src/services/ble/bleNativeUtils.ts`. React consumers are
  `src/hooks/useBleConnection.ts` (`useSyncExternalStore`) and
  `src/hooks/useDevicePairing.ts` (scan/connect/disconnect commands plus the
  auto-reconnect effect). `src/app/_layout.tsx` is the only app-level mount point
  and owns no BLE lifecycle today. The Jest mock
  `__mocks__/react-native-ble-plx.ts` can script scan results, connect
  `success | pending | { error }`, notifications, disconnects and adapter state —
  it cannot yet inject a scan error, stall or fail discovery, or resolve a
  `pending` connect after the fact.
- **User impact:** the "Connecting…" dead end disappears — a discovery stall now
  resolves to the existing `connectTimeout` error state, which the pairing screen
  already renders and allows a retry from. A failed scan reports immediately
  instead of after a misleading 15 s timeout. The leak fixes are invisible to
  users but stop the adapter holding links the app believes it released.
- **Dependencies:** none new. No package added, no native config change, no
  `app.json` edit. Builds on the merged `ble-connection-state-machine`,
  `auto-reconnect-last-device` and `jest-rntl-harness-ble-mock` specs.

## Data Model

`src/interfaces/ble.ts` — one added member on an existing union:

```ts
export type BleConnectionErrorCause =
  | 'scanTimeout'
  | 'scanFailed' // new: the native scan callback reported an error
  | 'connectTimeout'
  | 'connectRejected'
  | 'adapterOff'
  | 'unknown';
```

`BleConnectionSnapshot` is otherwise unchanged — `scanFailed` reuses the existing
`{ state: 'error'; cause; message }` variant.

New private state on `BleService`, not part of any public contract:

- `private connectAttemptId = 0` — monotonic token, incremented once per
  `connect()` call, used to decide whether a late-resolving `Device` belongs to
  the attempt currently in flight.
- `private isDestroyed = false` — makes `destroy()` idempotent and every public
  command a no-op afterwards.

No persistence change. MMKV keys, the stored last-paired device, and Health
Connect are untouched.

## Interfaces / API

**`bleConnectionMachine.ts` — one new event and superseding connect:**

```ts
| { type: 'scanFailed'; message: string }
```

Reduction:

- `scanFailed`: from `scanning` → `{ state: 'error', cause: 'scanFailed', message }`,
  falling back to `'BLE scan failed'` when the native error carries no message;
  from any other state → `current` unchanged, matching the reducer's existing
  total-function contract.
- `connectRequested`: from `connecting` with a different `deviceId` →
  `{ state: 'connecting', deviceId }` (superseding the active attempt);
  from `connecting` with the same `deviceId` → `current` unchanged (ignoring
  duplicate taps).

**`BleService` — signatures unchanged, behaviour changed:**

- `connect(deviceId: string): Promise<void>`
  - Arms **one** connect timer before `connectToDevice()` and clears it only
    after `discoverAllServicesAndCharacteristics()` settles. A stall in either
    phase rejects with `Error('CONNECT_TIMEOUT')` and takes the existing timeout
    branch → `cause: 'connectTimeout'` plus
    `safeCancelDeviceConnection(deviceId)`.
  - On any resolution arriving when the attempt is stale — snapshot no longer
    `connecting`, or `connectAttemptId` has moved on — the resolved `Device` is
    cancelled via `safeCancelDeviceConnection(manager, device.id)` before
    returning. This covers both the post-discovery drop and the connect promise
    that resolves after the race already rejected.
  - Still returns `void` and still never rejects to callers; failures become
    reported errors and snapshots.
- `cancelConnect(): void` — unchanged; its correctness now comes from the
  late-resolution guard above rather than from the eager
  `cancelDeviceConnection`.
- `startScan(onDeviceFound, serviceUUIDs?): void` — the native callback splits
  into explicit branches:
  - `error` present → `reportError(error, { scope: 'bleService.startScan' })`,
    `clearScanTimer()`, `safeStopScan(manager)`, dispatch
    `{ type: 'scanFailed', message }`. `onDeviceFound` is not invoked.
  - `!device` with no error → ignored, as today.
- `destroy(): void` — after the existing teardown, calls
  `safeDestroyManager(this.manager)` and sets `isDestroyed = true`. Calling it
  twice is a no-op; `startScan`, `connect`, `cancelConnect` and `disconnect`
  return early on a destroyed instance, and `monitorCharacteristic` keeps
  throwing its existing "not connected" error.

**`bleNativeUtils.ts` — one new wrapper, same throw-safe shape as its siblings:**

```ts
export function safeDestroyManager(manager: BleManager): void;
```

Reports through `crashService` under `scope: 'safeDestroyManager'`.

**Test mock (`__mocks__/react-native-ble-plx.ts`) — new scripting hooks:**

```ts
__scanError(error: Error): void;                  // fire the scan listener with an error
__discoverOutcome(o: 'success' | 'pending' | { error: Error }): void;
__resolveConnect(deviceId: string): void;         // resolve a previously 'pending' connect
```

`__discoverOutcome('pending')` makes
`discoverAllServicesAndCharacteristics()` return a never-settling promise, which
is what P2's regression test needs. `BleManager.destroy()` already exists in the
mock and stays as-is.

## Files Created

| File                                                      | Purpose                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/ble-connect-scan-lifecycle-hardening/SPEC.md` | This specification — the only new file; every code change lands in an existing module, so no new module is created. |

## Files Modified

| File                                                  | Change                                                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/interfaces/ble.ts`                               | Add `'scanFailed'` to `BleConnectionErrorCause`, with a doc comment distinguishing it from `'scanTimeout'`.                                                                             |
| `src/services/ble/bleConnectionMachine.ts`            | Add the `scanFailed` event and its `scanning → error` case.                                                                                                                             |
| `src/services/ble/bleNativeUtils.ts`                  | Add `safeDestroyManager`.                                                                                                                                                               |
| `src/services/ble/bleService.ts`                      | P2: one timer spanning connect + discovery. P3: attempt token and cancel-on-stale-resolution. P10: scan error branch. P8: `manager.destroy()` in `destroy()` plus `isDestroyed` guards. |
| `src/app/_layout.tsx`                                 | P8: mount-scoped `useEffect` whose cleanup calls `resetBleService()`, so app teardown releases the adapter listener and any active device.                                              |
| `__mocks__/react-native-ble-plx.ts`                   | Add `__scanError`, `__discoverOutcome`, `__resolveConnect`.                                                                                                                             |
| `src/tests/services/ble/bleConnectionMachine.test.ts` | Cases for `scanFailed` from `scanning` and its no-op from the other states.                                                                                                             |
| `src/tests/services/ble/bleService.test.ts`           | Four regression tests, one per item, plus updates to any existing assertion the new behaviour legitimately changes.                                                                     |
| `src/tests/services/ble/bleNativeUtils.test.ts`       | `safeDestroyManager` success and throwing-manager cases.                                                                                                                                |

## Implementation Steps

1. Add `'scanFailed'` to `BleConnectionErrorCause` in `src/interfaces/ble.ts`.
2. Add the `scanFailed` event and reducer case to `bleConnectionMachine.ts`;
   extend `bleConnectionMachine.test.ts` with the transition and the no-op cases.
3. Add `safeDestroyManager` to `bleNativeUtils.ts` and cover it in
   `bleNativeUtils.test.ts`.
4. Extend the mock with `__scanError`, `__discoverOutcome` and
   `__resolveConnect` — store the pending connect's resolver per device id so a
   `'pending'` outcome can be resolved later from a test.
5. **P10** — split the `startDeviceScan` callback guard into the error and
   no-device branches described above. Test: after `startScan`, script
   `__scanError(new Error('SCAN_FAILED'))`; assert the snapshot becomes
   `{ state: 'error', cause: 'scanFailed', message: 'SCAN_FAILED' }`, that
   `stopDeviceScan` was called, that `reportError` was called, and that advancing
   timers past `scanTimeoutMs` produces no further transition.
6. **P2** — replace `raceConnectWithTimeout` with a helper that arms the connect
   timer once and races
   `connectToDevice(...).then(d => d.discoverAllServicesAndCharacteristics()).then(() => d)`
   against it, clearing the timer only on settle. Test:
   `__connectOutcome('success')` with `__discoverOutcome('pending')`, call
   `connect()`, advance `connectTimeoutMs`, assert
   `{ state: 'error', cause: 'connectTimeout', … }` and that
   `cancelDeviceConnection` was called.
7. **P3** — add `connectAttemptId`, increment it at the top of `connect()`, and
   make the post-await stale check cancel the resolved device before returning.
   Two tests: (a) `cancelConnect()` during a `'pending'` connect, then
   `__resolveConnect(deviceId)` → the snapshot stays `idle` **and**
   `cancelDeviceConnection` is called with that device id after the resolution;
   (b) a second `connect()` to a different device while the first is pending →
   the first device is cancelled and the second connects, with no cancel issued
   against the winning device.
8. **P8** — call `safeDestroyManager` from `destroy()`, add the `isDestroyed`
   flag and its early returns, and wire the `resetBleService()` cleanup effect
   into `src/app/_layout.tsx`. Tests: `destroy()` calls `manager.destroy()` and is
   safe to call twice; a destroyed service ignores `startScan` and `connect`.
9. Re-run the BLE suites and repair any assertion the new behaviour legitimately
   changes — per the issue, an unmodified suite is explicitly _not_ the success
   criterion here. Verify with:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

## Style & Conventions

- `CLAUDE.md` layering: all logic stays in `src/services/ble/` (plain TypeScript,
  no React imports); the only `app/` change is the teardown effect in the root
  layout.
- Native calls stay behind the throw-safe `safe*` wrappers in
  `bleNativeUtils.ts` rather than raw `try/catch` inside `BleService` — the
  pattern PR #69 established.
- Crash logging: every new failure path (scan callback error, manager destroy)
  reports through `src/services/crashService.ts`, per the cross-cutting
  requirement.
- The reducer stays a total function — `scanFailed` returns `current` unchanged
  outside `scanning`.
- Accessibility: N/A — no new or changed interactive element. The pairing
  screen's existing error rendering (`src/app/index.tsx:62`) already covers the
  new cause without markup changes.
- **Deliberate deviation, i18n:** `message` on an `error` snapshot is an English
  constant produced by the reducer and rendered raw by `src/app/index.tsx`
  alongside the translated `pairing.errorPrefix`. `scanFailed` follows that
  established pattern rather than introducing a per-cause translation table,
  which would be a separate and wider change touching every existing cause. No
  new key is added to `en.json` / `ja.json`, and no user-facing string is
  hardcoded in a component.

## Acceptance Criteria

- [ ] A connect whose service discovery never resolves leaves `connecting` within
      `connectTimeoutMs` and lands on
      `{ state: 'error', cause: 'connectTimeout' }`, with
      `cancelDeviceConnection` called for the device — covered by a test.
- [ ] `cancelConnect()` during an in-flight connect that later resolves leaves the
      snapshot `idle` **and** cancels the resolved device — the test asserts the
      cancel call, not just the snapshot.
- [ ] A superseded connect attempt (a second `connect()` while the first is
      pending) cancels the abandoned device and does not cancel the winning one.
- [ ] A native scan error produces `{ state: 'error', cause: 'scanFailed' }`
      immediately, stops the scan, and reports through `crashService`; it is no
      longer misreported as `scanTimeout`.
- [ ] `destroy()` destroys the underlying `BleManager`, is idempotent, and leaves
      the instance inert; `src/app/_layout.tsx` invokes `resetBleService()` on
      unmount.
- [ ] `reduceBleConnectionState` handles `scanFailed` from `scanning` and returns
      the same snapshot reference from every other state.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass.

## Constraints

- **Non-goals:** no UX decision and no screen redesign. The other three groups
  from the M1 BLE audit stay out of scope. No retry or backoff policy, no
  auto-reconnect change, no new user-facing copy, no per-cause i18n table, and no
  change to the `scanTimeoutMs` / `connectTimeoutMs` defaults (15000 / 10000).
- **Behaviour changes on purpose:** unlike PR #69, this work is not
  behaviour-neutral. Existing tests may need updating, and each item ships its own
  regression test.
- **Public API compatibility:** every `BleService` method keeps its current
  signature, so `useBleConnection` and `useDevicePairing` need no change.
  `BleConnectionErrorCause` gains a member — any future exhaustive `switch` over
  it must handle `'scanFailed'`; none exists today (verified: no consumer
  switches on `cause`).
- **Unverified externally:** whether `react-native-ble-plx@3.5.x`'s
  `cancelDeviceConnection` rejects or resolves for a device id with no live link
  is not asserted here — `safeCancelDeviceConnection` swallows and reports either
  way, and the Jest mock resolves. Real-hardware confirmation is a manual
  `pnpm android` check, not part of the automated criteria.
- **Verification limits:** BLE is mocked at the module boundary
  (`__mocks__/react-native-ble-plx.ts`); no test runs against hardware, per
  `CLAUDE.md`'s testing rules.
