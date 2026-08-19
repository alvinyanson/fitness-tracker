# Feature: Auto-Reconnect to Last Paired Device on Launch

## Intent

Cold-starting the app with a remembered device in range lands in `connected` with no
user interaction; cold-starting with it out of range (or the user cancelling) leaves the
pairing screen in its normal scan-ready state within the connect timeout, distinguishing
the automatic reconnect attempt from a manual connect so the user always knows what the
app is doing and can back out of it.

## Context

- **Problem statement:** GitHub issue #8 asks for persist-on-connect, a bounded
  single-attempt auto-reconnect on launch, a distinct "reconnecting" state with a cancel
  action, and "forget device" clearing the stored id. `docs/specs.md` Milestone 1.1
  (line 20) requires the same persistence/auto-reconnect behavior.
- **Current code:** Most of this scope already shipped in
  `docs/specs/device-pairing-screen/SPEC.md` (merged, PR #48): `useDevicePairing`
  (`src/hooks/useDevicePairing.ts`) already persists `{ id, name }` via
  `setLastPairedDevice` on every successful connect, already reads
  `getLastPairedDevice()` on mount and — guarded by `autoReconnectAttemptedRef` so it
  fires at most once per mount — calls `bleService.connect(stored.id)` directly when the
  snapshot is `idle`, and `unpair()` already calls `setLastPairedDevice(null)` plus
  clears local state (issue's "forget device"). `src/app/index.tsx` only mounts
  `useDevicePairing` once `useBlePermissionGate()` resolves `'ready'`
  (`docs/specs/android-ble-permission-gate/SPEC.md`), so the hook structurally never
  attempts auto-reconnect while permissions are missing or the adapter is off — that gate
  is re-evaluated fresh on every mount. The bounded-timeout half of "bounded reconnect"
  is also already in place: `bleService.connect()` races a `connectTimeoutMs` timer
  (default 10000ms, `src/services/ble/bleService.ts`) and resolves to
  `error`/`connectTimeout` if the device never answers, at which point the existing
  screen already renders its normal scan-capable UI (Scan button enabled, empty device
  list) — nothing hangs.
  What is **not** built: the auto-reconnect attempt and a manual tap-to-connect look
  identical today (`getStatusText()` in `src/app/index.tsx` renders the same
  `pairing.connecting` copy for both, driven purely by
  `connection.state === 'connecting'`), so the issue's "distinct reconnecting state" and
  "cancel action that falls back to a normal scan" are unimplemented. There is also no
  way to cancel an in-flight `connect()` from outside `bleService` — `disconnect()`
  no-ops unless `connected`, and the only paths out of `connecting` today are
  succeed/timeout/reject/adapter-off, all internal to the service. A translation key
  (`pairing.reconnecting`, in both `en.json`/`ja.json`) already exists but is unused
  anywhere in `index.tsx` — it was added ahead of this issue and needs wiring, not
  creation.
- **User impact:** On a cold start with a remembered, in-range device, the user now sees
  "Reconnecting…" instead of the generic "Connecting…" — a clearer signal that this
  happened automatically, not from a tap — plus a Cancel button that immediately aborts
  the attempt and drops back to the idle scan-ready screen instead of forcing the user to
  wait out the full connect timeout.
- **Dependencies:** No new package. Builds on `bleService`
  (`docs/specs/ble-connection-state-machine/SPEC.md`), `deviceStorage`
  (`docs/specs/mmkv-storage-layer/SPEC.md`), and `useDevicePairing`/`index.tsx`
  (`docs/specs/device-pairing-screen/SPEC.md`), all present and functioning.

## Data Model

No new persisted shape — `deviceStorage`'s single `PairedDevice` (`{ id, name }`) is
reused unchanged; this issue adds no MMKV key.

One addition to the connection-state machine's internal event union
(`src/services/ble/bleConnectionMachine.ts`), not `BleConnectionSnapshot` itself (the
`connecting` variant's shape — `{ state: 'connecting'; deviceId: string }` — is
unchanged; cancelling it always lands on the existing `{ state: 'idle' }` shape, no new
snapshot variant needed):

```ts
export type BleConnectionEvent =
  | /* ...existing members unchanged... */
  | { type: 'connectCancelled' };
```

New transition row:

| Current      | Event              | Next   |
| ------------ | ------------------ | ------ |
| `connecting` | `connectCancelled` | `idle` |

This mirrors the existing `scanning + scanStopped -> idle` row exactly — cancelling a
user-abortable in-flight operation returns to `idle`, not `error` (an aborted attempt is
not a failure).

No new field on `useDevicePairing`'s return type's existing members — the "was this
connect auto-triggered" distinction is local hook state, not something `bleService` or
`BleConnectionSnapshot` needs to know about (the service has no concept of
"auto-reconnect" today per the connection-state-machine spec, and this issue does not
change that boundary).

## Interfaces / API

### `src/services/ble/bleConnectionMachine.ts` — one additive event

`reduceBleConnectionState` gains the `connectCancelled` case per the transition row
above; every other case is unchanged. Total-function contract preserved: `idle`, or
any other current state, ignores `connectCancelled` (unchanged/no-op), consistent with
every existing not-applicable pairing.

### `src/services/ble/bleService.ts` — one additive method

```ts
cancelConnect(): void;
```

- No-ops if `getSnapshot().state !== 'connecting'`.
- Otherwise: clears the pending connect timer (so it can't also fire afterward and race
  the cancellation), calls `safeCancelDeviceConnection(this.manager, deviceId)` for the
  `deviceId` carried on the current `connecting` snapshot (best-effort, same helper
  `connect()`'s own timeout path already uses), then dispatches `connectCancelled`.
- The in-flight `connect()` call's own `await`/`catch` continues running against the
  now-superseded manager promise, but every branch inside it already guards on
  `this.snapshot.state === 'connecting'` before applying `connectSucceeded` /
  `connectTimedOut` / `connectRejected` (existing code, unchanged) — since the snapshot
  is now `idle`, whichever branch resolves after cancellation is a no-op at the reducer
  level. This is the same late-resolution safety the adapter-power-off path already
  relies on; `cancelConnect()` adds no new guard because none is needed.

### `src/hooks/useDevicePairing.ts` — extended return shape

```ts
export interface UseDevicePairingResult {
  connection: BleConnectionSnapshot;
  devices: DiscoveredDevice[];
  pairedDevice: PairedDevice | null;
  isScanning: boolean;
  isAutoReconnecting: boolean; // new
  scan: () => void;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => void;
  disconnect: () => void;
  unpair: () => void;
  cancelReconnect: () => void; // new
}
```

- **`isAutoReconnecting`**: new `useState<boolean>(false)`. Set `true` at the same point
  the existing auto-reconnect-on-mount effect calls `bleService.connect(stored.id)` (no
  change to that effect's existing guard/timing — still exactly one attempt per mount via
  `autoReconnectAttemptedRef`). Reset to `false` by a new effect watching `connection`:
  whenever `connection.state` is anything other than `'connecting'` while
  `isAutoReconnecting` is `true`, set it back to `false` — this covers every resolution
  path (`connected`, `error`/timeout, `error`/rejected, `idle` via cancel) with one rule,
  matching the existing "persist on connect" effect's pattern of deriving hook state from
  `connection` rather than threading a callback through `bleService.connect()`.
- **`cancelReconnect()`**: calls `bleService.cancelConnect()`. Does not itself set
  `isAutoReconnecting` to `false` — the effect above does that once `connection`
  transitions to `idle`, keeping "what turns the flag off" in one place. No-ops
  implicitly if there's nothing to cancel (delegates entirely to `bleService`'s own
  no-op guard).
- **Manual connects are unaffected**: `connectToDevice()` never sets
  `isAutoReconnecting`, so a user-initiated tap always renders the existing
  `pairing.connecting` copy, never `pairing.reconnecting` — the distinction is which
  call site triggered `connect()`, not the snapshot shape (which is identical either
  way, by design — see `ble-connection-state-machine`'s existing note that
  `connectRequested` from `idle` is "the auto-reconnect path," not a separate state).

### `src/app/index.tsx` — `PairingContent`, `'connecting'` branch only

- `getStatusText()`'s `'connecting'` case returns `t('pairing.reconnecting')` when
  `isAutoReconnecting` is `true`, else the existing `t('pairing.connecting')` — the
  already-present, previously-unused translation key.
- While `isAutoReconnecting` is `true`, render a Cancel button (new `pairing.cancel`
  key) calling `cancelReconnect`, in place of/alongside the status text — placement:
  directly under the status label, matching the paired-device card's existing
  action-button styling (`styles.button`/`styles.buttonSecondary`). Tapping it returns
  the screen to its normal idle state (Scan button enabled, paired-device card still
  showing the remembered device per the "disconnecting doesn't forget" rule already
  established for `disconnect()`/`unpair()`).
- No other branch of `getStatusText()` or the rest of the render tree changes.

## Files Created

| File | Purpose                                                                               |
| ---- | ------------------------------------------------------------------------------------- |
| N/A  | This issue extends existing modules from three prior specs; no new file is justified. |

## Files Modified

| File                                                  | Change                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/ble/bleConnectionMachine.ts`            | Add `connectCancelled` event and its `connecting -> idle` transition row.                                                                                                                                                                                                                                                      |
| `src/tests/services/ble/bleConnectionMachine.test.ts` | Add the `connecting + connectCancelled -> idle` case, plus a no-op case (e.g. `idle + connectCancelled` unchanged).                                                                                                                                                                                                            |
| `src/services/ble/bleService.ts`                      | Add `cancelConnect()`.                                                                                                                                                                                                                                                                                                         |
| `src/tests/services/ble/bleService.test.ts`           | Add cases: `cancelConnect()` while `connecting` clears the timer, calls `cancelDeviceConnection`, snapshot becomes `idle`; `cancelConnect()` while not `connecting` is a no-op; a connect that resolves/rejects/times out _after_ cancellation does not re-apply a snapshot change.                                            |
| `src/hooks/useDevicePairing.ts`                       | Add `isAutoReconnecting` state, the connection-watching reset effect, and `cancelReconnect()`; wire `isAutoReconnecting` on in the existing auto-reconnect-on-mount effect.                                                                                                                                                    |
| `src/tests/hooks/useDevicePairing.test.tsx`           | Add cases: mount with a stored device sets `isAutoReconnecting` true immediately and false once the mocked snapshot moves off `connecting`; `cancelReconnect()` calls `bleService.cancelConnect()`; a manual `connectToDevice()` call never sets `isAutoReconnecting`.                                                         |
| `src/app/index.tsx`                                   | `'connecting'` status text branches on `isAutoReconnecting`; render the Cancel button while auto-reconnecting.                                                                                                                                                                                                                 |
| `src/tests/app/index.test.tsx`                        | Add cases: mount with a stored paired device renders `pairing.reconnecting` (not `pairing.connecting`) and a visible Cancel action; tapping Cancel calls through to `bleService.cancelConnect` and the screen returns to its idle/scan-ready UI; a manual device tap still renders `pairing.connecting` with no Cancel button. |
| `src/services/i18n/translations/en.json`              | Add `pairing.cancel`. (`pairing.reconnecting` already exists and is reused as-is.)                                                                                                                                                                                                                                             |
| `src/services/i18n/translations/ja.json`              | Mirror `pairing.cancel` (enforced by `src/tests/services/i18n/localeCoverage.test.ts`).                                                                                                                                                                                                                                        |

## Implementation Steps

1. Add the `connectCancelled` event and `connecting -> idle` row to
   `bleConnectionMachine.ts`.
2. Add the corresponding `bleConnectionMachine.test.ts` cases.
3. Add `bleService.cancelConnect()` per the contract above, reusing the existing
   `safeCancelDeviceConnection` helper and the same timer-clearing pattern
   `connect()`'s timeout branch already uses.
4. Add the `bleService.test.ts` cases, including the late-resolution-is-a-no-op case
   (script a `'pending'` connect outcome, call `cancelConnect()`, then resolve/reject the
   underlying mocked promise and assert the snapshot stays `idle`).
5. Add `pairing.cancel` to `en.json` and mirror it in `ja.json`.
6. Extend `useDevicePairing.ts`: `isAutoReconnecting` state, set it in the existing
   auto-reconnect effect, add the reset effect keyed off `connection.state`, add
   `cancelReconnect()`, include both new fields in the returned object.
7. Add the `useDevicePairing.test.tsx` cases described above, extending the existing
   mocked-`bleService` harness with a `cancelConnect: jest.fn()` entry.
8. Update `index.tsx`'s `'connecting'` status-text branch and add the Cancel button,
   themed via `@/theme` only, matching the existing button style constants already in
   the file.
9. Add the `index.test.tsx` cases described above.
10. Run verification commands (below).

## Style & Conventions

- Explicit-union-over-booleans stays intact: `connectCancelled` is a first-class reducer
  event with its own transition row, not a side-channel flag on the service; the one new
  boolean (`isAutoReconnecting`) lives in the hook, mirroring `isScanning`'s
  already-justified precedent in `device-pairing-screen/SPEC.md` as "the one narrow,
  named exception," not a pattern this issue expands beyond that single case.
- Layering unchanged: `bleConnectionMachine.ts` stays pure/React-free,
  `bleService.ts` stays React-free with native access confined to the existing
  `safeCancelDeviceConnection` adapter helper, `useDevicePairing.ts` remains the only
  file bridging `bleService`/`deviceStorage` into React state, per `CLAUDE.md`'s
  layering contract.
- No hardcoded hex/font-size/radius in the new Cancel button — reuses `index.tsx`'s
  existing `styles.button`/`styles.buttonSecondary` constants rather than introducing new
  ones.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior BLE spec's
  convention.
- `pairing.reconnecting` is reused, not redefined — this spec treats the pre-existing key
  as the intended contract from the prior issue's authors, per the skill's instruction to
  base statements on what's actually in the repo.

## Acceptance Criteria

- [ ] Cold start with the remembered device powered on and in range: the screen briefly
      shows `pairing.reconnecting` with a visible Cancel action, then `pairing.connected`
      — no user interaction required.
- [ ] Cold start with the remembered device powered off: the screen shows
      `pairing.reconnecting` and Cancel, then — once `connectTimeoutMs` elapses — returns
      to the normal idle scan-ready UI (Scan button enabled, empty-state list) rendering
      the existing `error`/`connectTimeout` message, never stuck showing "Reconnecting…"
      indefinitely.
- [ ] Tapping Cancel during an auto-reconnect attempt calls `bleService.cancelConnect()`,
      the snapshot becomes `idle`, `isAutoReconnecting` becomes `false`, and the screen
      shows the normal scan-ready UI — the remembered device stays in the paired-device
      card (not forgotten).
- [ ] After `unpair()`, a subsequent cold start never calls `bleService.connect()` on
      mount (already covered by the existing `useDevicePairing.test.tsx` no-stored-device
      case; re-verified here since it's this issue's explicit acceptance criterion).
- [ ] A manual tap-to-connect (`connectToDevice`) always renders `pairing.connecting` and
      never shows the Cancel button, distinguishing it from the auto-reconnect path.
- [ ] `reduceBleConnectionState` has a passing test for `connecting + connectCancelled ->
idle` and at least one no-op case for the same event.
- [ ] `cancelConnect()` is a no-op (no dispatch, no snapshot change) when called while not
      `connecting`.
- [ ] A connect promise that resolves or rejects after `cancelConnect()` has already run
      does not change the snapshot away from `idle`.
- [ ] `ja.json` contains `pairing.cancel` (`localeCoverage.test.ts` passes).
- [ ] `pnpm test` passes, including all new/updated suites, with `react-native-ble-plx`
      mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — nothing here is platform-conditional.
- **One attempt, no retry loop** — already guaranteed by the existing
  `autoReconnectAttemptedRef` guard; this issue does not add polling or a second attempt
  after Cancel or timeout. A user who cancels or times out must act (manual reconnect tap
  or Scan), matching `device-pairing-screen/SPEC.md`'s existing "no retry loop"
  constraint.
- **No change to when auto-reconnect is attempted** — still exactly the existing
  mount-time check (`stored` device present and snapshot `idle`); this issue only makes
  that existing attempt distinguishable and cancellable in the UI. It does not add
  re-attempting on the app returning to foreground, on the adapter turning back on, or on
  any other trigger.
- **No new persisted state or MMKV key** — `deviceStorage`'s existing single
  `PairedDevice` slot is unchanged.
- **`bleService.destroy()` is still never called from this hook** — cancelling an
  auto-reconnect attempt tears down only that in-flight connect, not the service's
  adapter-state subscription or any other lifecycle piece; this matches the existing
  constraint from `device-pairing-screen/SPEC.md`.
- Functional verification of the actual cold-start/in-range/out-of-range behavior needs a
  real device and `pnpm android` (dev client) — unit tests cover the reducer, service,
  hook, and screen logic against mocks only, per `CLAUDE.md`'s "Expo Go does not work
  here" and BLE-mocking testing conventions.
