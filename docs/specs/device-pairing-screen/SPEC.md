# Feature: Device Pairing Screen — 0x180D Scan List with RSSI, Tap to Connect

## Intent

Opening the app with the BLE gate `'ready'` shows a live, RSSI-annotated list of nearby
Heart Rate Service (0x180D) devices that the user can tap to connect; a previously paired
device is remembered, offered as a one-tap reconnect, and attempted automatically on
launch, with every step of scan → connect → connected/disconnected/error rendered from
`bleService`'s existing connection-state union rather than any new boolean.

## Context

- **Problem statement:** GitHub issue #7 asks for the pairing screen itself: "scan list
  with RSSI, tap to connect." `docs/specs.md` Milestone 1.1 requires the same thing
  ("Scan for nearby devices advertising the Heart Rate Service (0x180D), list them with
  signal strength, allow tapping to connect" and "Persist the last-paired device ID
  locally so the app can attempt auto-reconnect on next launch"). Both prior specs in
  this repo explicitly deferred this exact work: `android-ble-permission-gate/SPEC.md`
  ("building the actual device scan UI is separate, not-yet-filed work") and
  `ble-connection-state-machine/SPEC.md` ("A `useBleConnection` hook... is separate,
  not-yet-filed work... writing it now with no consumer would be dead code" and "wiring
  [stop-scan-on-unmount] to actual unmount is the pairing-screen issue's job"). This is
  that issue.
- **Current code:** `src/app/index.tsx` today only renders `BlePermissionGateView` for a
  non-`'ready'` gate status; once `'ready'`, it renders a title and two `Link`s to
  `/workout` and `/history` — no scan, no device list, no connect action. The full
  scan/connect state machine already exists and needs no changes to its transitions:
  `src/services/ble/bleService.ts` (`BleService` singleton `bleService`) exposes
  `getSnapshot()`, `subscribe()`, `startScan(onDeviceFound)`, `stopScan()`,
  `connect(deviceId)`, `disconnect()`, `monitorCharacteristic(...)`, and `destroy()`,
  driven by the pure reducer in `bleConnectionMachine.ts`
  (`idle | scanning | connecting | connected | disconnected | error`, the last two
  carrying `reason`/`cause` payloads — see `src/interfaces/ble.ts`). Its reducer's
  transition table already special-cases `connectRequested` from `idle` as "the
  auto-reconnect path," which is exactly the affordance this screen needs and did not
  previously have a caller for. `src/services/storage/deviceStorage.ts` already persists
  one `PairedDevice` (`{ id, name }`, `src/interfaces/storage.ts`) under
  `@fitness_tracker/last-paired-device` via MMKV — also unused by any UI yet.
  `src/hooks/useBlePermissionGate.ts` is the only existing hook; no hook subscribes to
  `bleService` yet.
- **User impact:** The pairing screen becomes usable: users see nearby HR devices with
  signal strength, tap one to connect, see a paired-device card once connected, and get
  their device reconnected automatically the next time they open the app (no re-scan
  needed) as long as it's back in range. `Connecting`/`disconnected`/`error` snapshots
  each render distinct, non-blank feedback instead of an inert list.
- **Dependencies:** No new package. `react-native-ble-plx` (already installed),
  `bleService`, `bleConnectionMachine`, `deviceStorage`, and `useBlePermissionGate` are
  all present and unmodified in their contracts except the one addition below
  (`startScan`'s new optional filter parameter, additive and backward compatible).

### Reference code supplied with the issue — context only, not implemented as shown

The user supplied a `DevicePairingScreen` built on its own `useBleHeartRate` hook and a
flat `src/types/ble.ts` `ConnectionState`. As with the two prior BLE specs, this is reused
selectively:

- **Types location and shape:** stays exactly as already established —
  `src/interfaces/ble.ts`, `BleConnectionSnapshot`/`DiscoveredDevice`/`PairedDevice`
  already exist there and are reused unchanged. No `src/types/` directory is introduced.
- **Live heart-rate readout is out of scope.** The reference's hero BPM display,
  `heartRate` state, and `monitorCharacteristic`/`0x2A37` consumption belong to
  `docs/specs.md`'s "Live workout screen" (Milestone 1.2), a separate, not-yet-filed
  issue that will call `bleService.monitorCharacteristic` once connected. This screen
  connects a device and hands off; it does not read the HR characteristic.
- **One hook, not a mega-hook.** The reference's `useBleHeartRate` mixes scan, connect,
  HR value, and persistence into one hook returning eleven fields. Per `CLAUDE.md`'s
  layering contract (`services/` has no React import; `hooks/` adapts a service to
  React) and to keep this hook honest about what it owns (pairing, not HR), this spec
  introduces `useDevicePairing` scoped to scan/connect/persist only — no `heartRate`
  field exists on it, since nothing in this issue produces one.
- **Colors/styles are reference-only.** The reference's inline `#0F172A`/`#FF4B4B`-style
  hex values and its own `StyleSheet` are look-and-feel context, not the design system.
  This screen uses `@/theme` tokens exclusively, matching `BlePermissionGateView.tsx`'s
  existing precedent and `CLAUDE.md`'s "never hardcode a hex" rule.
- **Garmin broadcast-tip footer, unpair button, and disconnect button** are reused as
  concepts (they match `docs/specs.md`'s Addendum and its "last-paired device" language)
  but are re-themed and re-wired to this repo's actual hook/service contracts, not copied
  verbatim.
- **Scanning "all BLE devices" vs. "0x180D only":** the reference scans everything and
  never filters. The issue title and `docs/specs.md` both specifically call for scanning
  _the Heart Rate Service_. `bleService.startScan` currently calls
  `manager.startDeviceScan(null, ...)` (no UUID filter) — this spec adds an optional
  `serviceUUIDs` filter parameter to `startScan` (see Interfaces / API) rather than
  hardcoding the Heart Rate UUID inside the already-generic `bleService`, so the service
  stays reusable for any GATT profile and the HR-specific UUID lives with the caller.

## Data Model

No new persisted shape and no change to `BleConnectionSnapshot`, `DiscoveredDevice`, or
`PairedDevice` (all in `src/interfaces/ble.ts` / `src/interfaces/storage.ts`, unchanged).

One new constant module:

```ts
// src/services/ble/gattProfiles.ts
/** Standard BLE Heart Rate Service UUID (0x180D), full 128-bit form. */
export const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
```

- Lives beside `bleService.ts` rather than in `interfaces/`, because it's a concrete GATT
  constant, not a type — a future second GATT profile (e.g. a cycling cadence sensor)
  adds a sibling constant here rather than growing `interfaces/ble.ts`.
- No relationship to persistence: `deviceStorage`'s `PairedDevice` remains service-UUID
  agnostic (it stores only `{ id, name }` for whichever device last connected).

## Interfaces / API

### `src/services/ble/bleService.ts` — one additive change

```ts
startScan(
  onDeviceFound: (device: DiscoveredDevice) => void,
  serviceUUIDs?: string[] | null, // default null — unchanged scan-everything behavior
): void;
```

- `serviceUUIDs`, when provided, is passed straight through as `startDeviceScan`'s first
  argument (`manager.startDeviceScan(serviceUUIDs ?? null, { allowDuplicates: false }, ...)`)
  instead of the current hardcoded `null`. This is the OS/advertisement-level filter
  (devices not advertising a matching service never reach `onDeviceFound`), not a
  post-hoc filter in the callback.
- Every other method, the reducer, and all existing transitions are unchanged. Existing
  `bleService.test.ts` cases that call `startScan(onDeviceFound)` with one argument keep
  passing (default `null`, identical to today's behavior).

### `src/hooks/useDevicePairing.ts` — new, the only new hook

```ts
export interface UseDevicePairingResult {
  connection: BleConnectionSnapshot;
  devices: DiscoveredDevice[];
  pairedDevice: PairedDevice | null;
  isScanning: boolean;
  scan: () => void;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => void;
  disconnect: () => void;
  unpair: () => void;
}

export function useDevicePairing(): UseDevicePairingResult;
```

- **`connection`** mirrors `bleService.getSnapshot()`/`subscribe()` 1:1 — the hook adds no
  derived boolean; callers switch on `connection.state` exactly as the reducer defines it.
- **`devices`** accumulates `DiscoveredDevice`s surfaced via `startScan`'s callback for the
  current scan session only: upserted by `id` (a repeat sighting of the same id replaces
  its `rssi`/`name` in place rather than appending a duplicate row) and reset to `[]` on
  every new `scan()` call and on `stopScan()`/scan timeout is _not_ required to clear the
  list — the last-seen list stays visible until the next scan starts, so a user who taps
  "Stop Scan" can still see and tap what was found.
- **`pairedDevice`** is read once from `getLastPairedDevice()` (`deviceStorage.ts`) on
  mount and kept in local state; it is independent of `connection` — it can be non-null
  while `connection.state` is `'idle'`/`'disconnected'`/`'error'` (a device paired in a
  previous session/app launch that isn't currently connected), which is exactly what
  drives the "reconnect" affordance below.
- **`isScanning`** is `connection.state === 'scanning'`, exposed directly since JSX
  callers need it repeatedly and re-deriving `connection.state === 'scanning'` at every
  call site would be the "boolean creeping back in" `CLAUDE.md` warns against — this is
  the one derived field, kept explicit and named for exactly that comparison, not a
  substitute for the union itself (`connection` is still fully exposed).
- **`scan()`**: clears `devices`, calls
  `bleService.startScan(handleFound, [HEART_RATE_SERVICE_UUID])`. No-ops (per
  `bleService`'s own contract) if not currently `idle`/`disconnected`/`error`.
- **`stopScan()`**: calls `bleService.stopScan()`.
- **`connectToDevice(deviceId)`**: calls `bleService.connect(deviceId)`. On the snapshot
  transitioning to `'connected'` for this call, the hook writes
  `setLastPairedDevice({ id: device.id, name: device.name })` via `deviceStorage.ts` and
  updates local `pairedDevice` state to match — this is the "persist on connect" step;
  `bleService` itself never touches storage (unchanged from the connection-state-machine
  spec's explicit "no last-paired-device persistence changes... deciding when to persist
  is the future hook's concern").
- **`disconnect()`**: calls `bleService.disconnect()`. Does not clear `pairedDevice` —
  disconnecting (explicit or unexpected) keeps the device remembered for the next
  reconnect/relaunch, matching `docs/specs.md`'s "remember the last paired device."
- **`unpair()`**: calls `bleService.disconnect()` if currently connected, then
  `setLastPairedDevice(null)` and clears local `pairedDevice` state. This is the one path
  that actually forgets the device.
- **Auto-reconnect on mount:** a `useEffect` runs once: if `getLastPairedDevice()` returns
  a device and `bleService.getSnapshot().state === 'idle'`, call
  `bleService.connect(device.id)` immediately (no scan first — `connect(deviceId)` works
  directly against a known device id per `bleService`'s existing contract; this is the
  reducer's already-modeled `idle → connectRequested → connecting` "auto-reconnect path").
  If the device is out of range, this ends in `'error'`/`connectTimeout` or
  `'connectRejected'` like any other failed connect — the screen shows that error state
  and the user can retry or scan manually; the hook does not retry automatically and does
  not treat this as a special case beyond the one attempt.
- **Cleanup:** the hook's `useEffect` cleanup calls `bleService.stopScan()` (no-op if not
  scanning) on unmount. It does **not** call `bleService.destroy()` — `bleService` is a
  module-level singleton shared with whatever screen consumes it next (e.g. the live
  workout screen keeping the same connection alive across navigation is the entire point
  of "a disconnect never kills an active session"); only in-progress scanning is torn
  down on navigating away, not the live connection.

### `src/components/DeviceListItem.tsx` — new, presentational only

```ts
export interface DeviceListItemProps {
  device: DiscoveredDevice;
  disabled: boolean; // true while a connect attempt is already in flight
  onPress: (deviceId: string) => void;
}

export function DeviceListItem(props: DeviceListItemProps): ReactNode;
```

- Renders name (falls back to a "Unknown device" translated string when `name` is
  `null`), id, and RSSI (`rssi` or an em dash when `null`), themed via `@/theme` only —
  no hardcoded hex/size, matching `BlePermissionGateView.tsx`'s existing precedent.
- Whole row is pressable (`onPress(device.id)`); `disabled` dims it and blocks the press,
  covering "tap to connect" while a connect attempt for a different or the same device is
  already `connecting`.

### `src/app/index.tsx` — rewritten body for the `'ready'` branch

- Unchanged: still calls `useBlePermissionGate()` first and renders
  `BlePermissionGateView` for any non-`'ready'` status, exactly as today.
- Once `'ready'`, now calls `useDevicePairing()` and renders, top to bottom:
  1. A connection-status label (translated string keyed off `connection.state`, e.g.
     "Scanning…", "Connecting…", "Connected", "Disconnected", error message from
     `connection.state === 'error' ? connection.message : ...`).
  2. If `pairedDevice` is set: a paired-device card showing its name/id, a
     Connect/Disconnect button (label and handler depend on whether `connection.state`
     is currently `'connected'` for _that_ device id vs. anything else — tapping it calls
     `connectToDevice(pairedDevice.id)` or `disconnect()` respectively) and an Unpair
     button calling `unpair()`.
  3. A Scan/Stop Scan button toggling on `isScanning`, calling `scan()`/`stopScan()`.
  4. The discovered-device list (`devices`) rendered via `FlatList` + `DeviceListItem`,
     `onPress` wired to `connectToDevice`; an empty-state message when `devices.length
=== 0` (distinct copy for "scanning, nothing yet" vs. "not scanning, tap Scan").
  5. The existing `Link`s to `/workout` and `/history` are kept, unchanged, at the bottom
     — this screen remains the navigation hub; nothing about this issue removes that.

## Files Created

| File                                           | Purpose                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/services/ble/gattProfiles.ts`             | `HEART_RATE_SERVICE_UUID` constant (0x180D, full 128-bit form).                         |
| `src/hooks/useDevicePairing.ts`                | React adapter over `bleService` + `deviceStorage`: scan/connect/persist/auto-reconnect. |
| `src/components/DeviceListItem.tsx`            | Presentational scan-result row: name, id, RSSI, tap-to-connect.                         |
| `src/tests/hooks/useDevicePairing.test.tsx`    | Hook behavior: scan/connect/disconnect/unpair, persistence, auto-reconnect on mount.    |
| `src/tests/components/DeviceListItem.test.tsx` | Render + press-to-connect + disabled-state coverage for the row component.              |

## Files Modified

| File                                        | Change                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/ble/bleService.ts`            | `startScan` gains an optional `serviceUUIDs?: string[] \| null` second parameter, passed through to `manager.startDeviceScan`.                                                   |
| `src/tests/services/ble/bleService.test.ts` | Add a case asserting `startScan(cb, [uuid])` calls `manager.startDeviceScan` with that array (spy on the mock method).                                                           |
| `src/app/index.tsx`                         | Render the pairing UI described above for the `'ready'` gate status; permission-gate branch untouched.                                                                           |
| `src/tests/app/index.test.tsx`              | Update the `'ready'`-status test(s) for the new scan/connect UI; add cases for scan → device appears → tap → connected, and auto-reconnect-on-mount when a paired device exists. |
| `src/services/i18n/translations/en.json`    | Add `pairing.*` keys for scan/connect/paired-device/unpair/status/empty-state copy (see Implementation Steps).                                                                   |
| `src/services/i18n/translations/ja.json`    | Mirror every new `pairing.*` key (enforced by `src/tests/services/i18n/localeCoverage.test.ts`).                                                                                 |

## Implementation Steps

1. Add `src/services/ble/gattProfiles.ts` with `HEART_RATE_SERVICE_UUID`.
2. Extend `bleService.startScan` with the optional `serviceUUIDs` parameter; update the
   internal `manager.startDeviceScan(serviceUUIDs ?? null, ...)` call. No reducer or
   snapshot changes.
3. Add the `bleService.test.ts` case for the new parameter being passed through.
4. Add the new `pairing.*` keys to `en.json` and mirror them in `ja.json` — at minimum:
   `pairing.scan`, `pairing.stopScan`, `pairing.scanning`, `pairing.connecting`,
   `pairing.connected`, `pairing.disconnected`, `pairing.unknownDevice`,
   `pairing.emptyScanning`, `pairing.emptyIdle`, `pairing.connect`, `pairing.disconnect`,
   `pairing.unpair`, `pairing.pairedDeviceLabel`, `pairing.rssiUnavailable`. Existing
   `pairing.title`/`goToWorkout`/`goToHistory`/`goToSettings` keys are untouched.
5. Implement `src/components/DeviceListItem.tsx`, themed via `@/theme` only.
6. Write `src/tests/components/DeviceListItem.test.tsx`: renders name/id/rssi; renders the
   "unknown device" fallback when `name` is `null`; renders an em dash when `rssi` is
   `null`; `onPress` fires with the device id; disabled row does not fire `onPress`.
7. Implement `src/hooks/useDevicePairing.ts` per the contract above.
8. Write `src/tests/hooks/useDevicePairing.test.tsx` against the mocked `bleService`
   module and mocked `deviceStorage` (jest module mocks, matching
   `useBlePermissionGate`'s spy-based test style): `scan()` calls
   `bleService.startScan` with `[HEART_RATE_SERVICE_UUID]`; discovered devices upsert by
   id (rssi update on repeat sighting doesn't duplicate the row); `connectToDevice`
   success persists via `setLastPairedDevice`; `disconnect()` leaves `pairedDevice` set;
   `unpair()` disconnects (if connected) and clears both storage and local state; mount
   with an existing `getLastPairedDevice()` result and `bleService` snapshot `'idle'`
   calls `bleService.connect` with that id automatically, exactly once; mount with no
   stored device never calls `connect`.
9. Rewrite the `'ready'` branch of `src/app/index.tsx` per Interfaces / API, keeping the
   permission-gate branch untouched.
10. Update `src/tests/app/index.test.tsx`: replace the old ready-state assertions
    (`Go to Workout`/`Go to History` alone) with coverage for the new UI while keeping
    those two links asserted present; add a scan → tap device → connected flow (mocking
    `bleService`); add an auto-reconnect-on-mount case (mocking `deviceStorage` to return
    a paired device and asserting the connecting/connected UI appears without the user
    tapping Scan).
11. Run verification commands (below).

## Style & Conventions

- Layering: `useDevicePairing.ts` is the only file that imports both `bleService` and
  `deviceStorage` and adapts them to React state — it imports no native module directly,
  matching `CLAUDE.md`'s `app → components → hooks → services` contract.
  `DeviceListItem.tsx` imports nothing from `services/`, only from `interfaces/` (its
  prop type) and `@/theme`, matching `components/` never importing `services/` directly.
- `gattProfiles.ts` stays React-free and native-import-free (just a string constant),
  consistent with `bleService.ts`/`bleConnectionMachine.ts`'s existing style.
- Explicit connection-state union stays the single source of truth for status rendering;
  `isScanning` is the one narrow, named exception already justified above — no other
  boolean is introduced in its place.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior BLE spec's
  convention (`src/tests/hooks/useDevicePairing.test.tsx` for `src/hooks/useDevicePairing.ts`,
  etc.).
- No hardcoded hex/font-size/radius in `DeviceListItem.tsx` or the updated `index.tsx` —
  theme tokens only; no custom `fontFamily` (fonts are still pending per `CLAUDE.md`).
- `docs/ui-reference/design.md`'s mockups are reference-only for this screen's look — no
  measurement/asset extraction, and any control appearing there but not in this spec
  (e.g. a live BPM readout) is deliberately excluded rather than added because "it's in
  the mockup," per `CLAUDE.md`'s explicit instruction on that file.

## Acceptance Criteria

- [ ] With the BLE gate `'ready'` and no paired device stored, the screen shows an idle
      empty-state and a Scan button; no auto-connect attempt occurs.
- [ ] Tapping Scan transitions `connection.state` to `'scanning'`, calls
      `bleService.startScan` with `[HEART_RATE_SERVICE_UUID]`, and any device surfaced by
      the (mocked) scan callback appears in the list with its name/id/RSSI.
- [ ] Tapping a discovered device calls `connectToDevice`, transitions through
      `'connecting'` to `'connected'` on success, and persists that device via
      `setLastPairedDevice` (verified against the mocked `deviceStorage`).
- [ ] With a paired device already stored on mount, the screen calls
      `bleService.connect(device.id)` automatically without the user tapping Scan, and
      renders the connecting/connected state for it.
- [ ] An unexpected or timed-out connect attempt renders the `'error'`/`'disconnected'`
      state's message distinctly from the idle empty-state copy (no blank/silent screen).
- [ ] `Disconnect` calls `bleService.disconnect()` and leaves the paired-device card
      visible (device stays remembered). `Unpair` additionally clears
      `deviceStorage`'s stored device and removes the paired-device card.
- [ ] Navigating away from the pairing screen while scanning stops the scan
      (`bleService.stopScan` called) without calling `bleService.destroy()`.
- [ ] `ja.json` contains every new `pairing.*` key added to `en.json`
      (`localeCoverage.test.ts` passes).
- [ ] `pnpm test` passes, including all new/updated suites, with `react-native-ble-plx`
      and `deviceStorage`/MMKV mocked — no real native module or device touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — no iOS branch; nothing here is platform-conditional
  since `react-native-ble-plx`'s scan/connect API is already platform-agnostic at this
  layer.
- **No live heart-rate display.** This screen connects a device and shows connection
  state; it does not call `monitorCharacteristic` or render a BPM value. That is the
  "Live workout screen" issue's scope (`docs/specs.md` Milestone 1.2), not this one.
- **No new persistence shape.** `deviceStorage.ts`'s single `PairedDevice` slot is reused
  as-is; this issue does not add multi-device history, a "recently paired" list, or any
  new MMKV key.
- **One auto-reconnect attempt on mount, no retry loop.** If the stored device is out of
  range, the hook does not poll or retry — the resulting `'error'`/`'connectRejected'`
  (or timeout) state is rendered and the user acts (manual reconnect tap, or Scan).
- **No sorting/filtering beyond the 0x180D service filter.** The discovered-device list
  renders in discovery order; RSSI-based sorting or a minimum-signal cutoff is a UX
  enhancement not requested by the issue or `docs/specs.md` and is left for later if
  wanted.
- **`bleService.destroy()` is never called from this hook.** The connection (once
  `'connected'`) must survive navigation to the live workout screen — only scanning stops
  on unmount, matching `CLAUDE.md`'s "a disconnect never kills an active session" domain
  rule extended to "navigating away from the pairing screen doesn't kill a connection
  either."
- The reference implementation supplied with the issue is context only, per the note in
  Context — its mega-hook shape, HR display, and inline styling are not carried into this
  design.
