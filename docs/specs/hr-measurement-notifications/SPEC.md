# Feature: HR Measurement Notifications + Characteristic Parser

## Intent

Once a Heart Rate device is connected, the app subscribes to Heart Rate Measurement
(`0x2A37`) notifications, correctly decodes every field the GATT payload can carry (uint8
or uint16 BPM, sensor-contact status, optional energy expended, optional RR intervals),
and exposes a live, typed BPM stream through a hook — with a pure, dependency-free parser
covered by a unit-test suite that exercises every flags-byte branch and rejects malformed
input instead of emitting garbage.

## Context

- **Problem statement:** [Issue #9](https://github.com/alvinyanson/fitness-tracker/issues/9)
  — `docs/specs.md` Milestone 1.2 ("Live workout screen") requires that "once connected,
  subscribe to the Heart Rate Measurement characteristic notifications and display current
  BPM live." No code in the repo parses `0x2A37` today: `src/services/ble/gattProfiles.ts`
  defines only the service/characteristic UUID constants, and a repo-wide search for
  `heartRate|HeartRate|2A37|2a37` outside that file returns nothing. `bleService.ts`
  exposes a generic `monitorCharacteristic()` primitive but forwards raw base64 values
  unparsed — issue #6's own spec (`docs/specs/ble-connection-state-machine/SPEC.md`)
  states heart-rate parsing was deliberately deferred: _"HR parsing consumes this
  primitive in a separate, not-yet-filed issue."_ This is that issue.
  - The issue names `src/services/ble/heartRateParser.ts` as the expected file. Per
    instruction accompanying this spec request, that literal filename is not binding —
    see [Files Created](#files-created) for the names actually used, chosen to match
    existing `services/ble/` naming (domain-noun files: `gattProfiles.ts`,
    `bleConnectionMachine.ts`, `bleSubscriptions.ts`).
- **Current code:**
  - `src/services/ble/gattProfiles.ts` — `HEART_RATE_SERVICE_UUID` and
    `HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID` constants (128-bit form). Reused as-is.
  - `src/services/ble/bleService.ts` — `BleService.monitorCharacteristic(serviceUUID,
characteristicUUID, onValue, onError): () => void` throws synchronously if
    `getSnapshot().state !== 'connected'`; wraps `device.monitorCharacteristicForService`;
    forwards the characteristic's raw base64 `value` via `onValue`; tracks the returned
    `Subscription` in `BleSubscriptionTracker` so disconnect/destroy/reconnect cycles
    can't leak or duplicate callbacks (asserted by the existing "exactly-once across 3
    connect/monitor/disconnect cycles" test in `bleService.test.ts`). This is the only
    primitive this feature needs from `bleService` — no changes to `bleService.ts` itself.
  - `src/interfaces/ble.ts` — `BleConnectionSnapshot` discriminated union
    (`idle | scanning | connecting | connected | disconnected | error`, each with its own
    payload). `BleService.subscribe`/`getSnapshot` broadcast this snapshot; the existing
    `useDevicePairing` hook reads it via `useSyncExternalStore`. The new hook in this spec
    reuses that same pattern rather than inventing a second state-sync mechanism.
  - `src/hooks/useDevicePairing.ts` — owns scan/connect/disconnect/pairing. It does not
    call `monitorCharacteristic`; no HR consumption exists anywhere in the hook layer
    today.
  - `__mocks__/react-native-ble-plx.ts` — the Jest manual mock already supports
    `__emitNotification(characteristicUUID, base64Value)`, which is sufficient for
    testing the new subscribe/unsubscribe wiring without any mock changes.
- **User impact:** The live workout screen (a separate, not-yet-filed issue per Milestone
  1.2's remaining bullets — timer, Start/Pause/Resume/Stop, rolling avg, reconnect
  indicator) will have a real BPM stream to render instead of a stub. No user-visible
  change ships from this spec alone, since no screen consumes the new hook yet.
- **Dependencies:** Depends on #3 (`docs/specs/jest-rntl-harness-ble-mock/SPEC.md` — the
  BLE Jest mock and harness) and #6 (`docs/specs/ble-connection-state-machine/SPEC.md` —
  `bleService.monitorCharacteristic` and the connection-state union), both merged. Also
  builds directly on top of #7's `useDevicePairing` connected-state flow
  (`docs/specs/device-pairing-screen/SPEC.md`), which explicitly deferred "live heart-rate
  readout" to this issue.

## Data Model

New file `src/interfaces/heartRate.ts`:

```ts
/** Sensor-contact status decoded from flags-byte bits 1–2 (Bluetooth GATT 0x2A37). */
export type HeartRateSensorContact =
  | 'notSupported' // bit 1 = 0: device can't report contact at all
  | 'contactDetected' // bit 1 = 1, bit 2 = 1
  | 'contactNotDetected'; // bit 1 = 1, bit 2 = 0

/** One decoded Heart Rate Measurement notification. */
export interface HeartRateSample {
  /** Beats per minute. uint8 (0–255) or uint16 per flags-byte bit 0. */
  bpm: number;
  sensorContact: HeartRateSensorContact;
  /** Energy Expended in kilojoules, cumulative since last reset. Present only when flags-byte bit 3 is set. */
  energyExpended?: number;
  /** RR intervals in milliseconds (converted from the GATT 1/1024s unit). Present only when flags-byte bit 4 is set; empty array is valid (flag set, zero intervals in this payload is not possible per spec, but the field is only ever omitted, never empty — parser guarantees at least one entry whenever present). */
  rrIntervals?: number[];
  /** `Date.now()` at parse time — the device does not transmit a timestamp. */
  timestamp: number;
}
```

No persistence: samples are a live stream, not stored. Session-level aggregation
(avg/max/min) and calorie math are out of scope here (see Constraints) and will consume
`HeartRateSample[]` in a later, not-yet-filed issue.

## Interfaces / API

### `src/services/ble/heartRateMeasurement.ts` (pure, dependency-free)

```ts
/**
 * Decodes a Heart Rate Measurement (0x2A37) notification payload.
 * @param base64Value raw characteristic value as delivered by monitorCharacteristic's onValue callback
 * @returns a HeartRateSample, or null if the payload is malformed/truncated
 */
export function parseHeartRateMeasurement(
  base64Value: string,
): HeartRateSample | null;
```

Behavior, in order:

1. Decode `base64Value` to bytes using a small local base64→`Uint8Array` decoder defined
   in this file (no `Buffer`/`atob` — neither is guaranteed to exist in a bare Hermes/RN
   runtime, and depending on either would break the "lifts into another project
   unchanged" requirement from the issue and from `CLAUDE.md`'s portability rule).
   Malformed base64 (invalid characters, odd padding) → return `null`.
2. Byte 0 is the flags byte. Fewer than 1 byte total → return `null`.
   - Bit 0: `0` = BPM is byte 1 (uint8); `1` = BPM is bytes 1–2 (uint16, little-endian).
   - Bits 1–2: sensor contact, decoded per the `HeartRateSensorContact` table above.
   - Bit 3: Energy Expended present, uint16 little-endian, immediately following BPM.
   - Bit 4: RR-Intervals present, one or more uint16 little-endian values (each in
     1/1024s units, converted to ms as `value * 1000 / 1024`), filling the remainder of
     the payload after BPM and (if present) Energy Expended.
   - Bits 5–7: reserved, ignored.
3. Compute the expected minimum length from the flags actually set (1 + BPM width +
   (energy present ? 2 : 0)) and require at least that many bytes; if RR-intervals is
   flagged, require the remaining byte count after that point to be a positive, even
   multiple of 2 (each RR value is 2 bytes) — an odd trailing byte means a truncated
   payload. Any shortfall → return `null` rather than parsing partial/garbage data.
4. On success, build and return the `HeartRateSample`, stamping `timestamp: Date.now()`.

No React import, no native import, no import from `bleService.ts` — matches
`CLAUDE.md`'s "pure logic in `services/`... free of React and native imports" testing
guidance and the existing precedent set by `bleConnectionMachine.ts`.

### `src/services/ble/heartRateMonitor.ts` (subscribe/unsubscribe helpers)

```ts
/**
 * Subscribes to Heart Rate Measurement notifications on the currently connected device.
 * Delegates to bleService.monitorCharacteristic and decodes each payload via
 * parseHeartRateMeasurement before forwarding it.
 *
 * @throws the same synchronous error as bleService.monitorCharacteristic if the
 *   connection snapshot is not `connected` (wired to the connection-state union, per
 *   the issue's requirement — this file does not duplicate that state check, it inherits
 *   it from bleService so there is exactly one source of truth for "are we connected").
 * @returns an unsubscribe function
 */
export function subscribeToHeartRate(
  onSample: (sample: HeartRateSample) => void,
  onError?: (error: Error) => void,
): () => void;
```

Malformed payloads (parser returns `null`) are silently dropped — `onSample` is not
called and `onError` is not invoked, per the issue's "reject/ignore malformed... instead
of emitting a garbage BPM." A payload-level decode failure is not a connection error, so
it must not surface through `onError`, which is reserved for the underlying
`bleService`/native monitoring failure path.

**Design decision — kept off `bleService`:** the issue's wording ("subscribe/unsubscribe
helpers on `bleService`") is not followed literally. Issue #6's own spec states
`bleService` is deliberately HR-agnostic ("does not... know about UUID `0x2A37`"), and
`CLAUDE.md`'s layering goal ("generic logic in the middle, app-specific wiring at the
edges... if something can't be written that way, say so") means a Heart-Rate-specific
method has no business on the generic connection-management class. `heartRateMonitor.ts`
composes `bleService.monitorCharacteristic` + `parseHeartRateMeasurement` instead,
preserving `bleService.ts` untouched. This is the reason `bleService.ts` does not appear
in [Files Modified](#files-modified).

### `src/hooks/useHeartRateMonitor.ts`

```ts
export interface UseHeartRateMonitorResult {
  /** Most recent decoded sample, or null before the first notification / while disconnected. */
  sample: HeartRateSample | null;
}

export function useHeartRateMonitor(): UseHeartRateMonitorResult;
```

Reads `bleService`'s connection snapshot via the same `useSyncExternalStore(
bleService.subscribe, bleService.getSnapshot)` pattern already used in
`useDevicePairing`. When `connection.state === 'connected'`, calls
`subscribeToHeartRate` inside a `useEffect` keyed on the connected device id, storing
each sample via `useState`; unsubscribes on disconnect or unmount. When not connected,
`sample` resets to `null` — per `CLAUDE.md`'s "a disconnect never kills an active
session," this hook only tracks the live readout, not session-level state, so resetting
`sample` to `null` on disconnect is correct here and does not affect any future
session/timer state (owned elsewhere).

## Files Created

| File                                                  | Purpose                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/interfaces/heartRate.ts`                         | `HeartRateSample` / `HeartRateSensorContact` types.                                     |
| `src/services/ble/heartRateMeasurement.ts`            | Pure `parseHeartRateMeasurement` — flags-byte decode, base64→bytes, validation.         |
| `src/services/ble/heartRateMonitor.ts`                | `subscribeToHeartRate` — wires the parser to `bleService.monitorCharacteristic`.        |
| `src/hooks/useHeartRateMonitor.ts`                    | React hook exposing the live decoded BPM sample to screens.                             |
| `src/tests/services/ble/heartRateMeasurement.test.ts` | Unit tests: hand-built base64 payloads for every flags-byte branch, no mocks.           |
| `src/tests/services/ble/heartRateMonitor.test.ts`     | Subscribe/unsubscribe wiring test against the existing BLE mock's `__emitNotification`. |
| `src/tests/hooks/useHeartRateMonitor.test.ts`         | Hook test: sample updates on notification, resets/unsubscribes on disconnect/unmount.   |

## Files Modified

| File | Change                                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N/A  | No existing file requires a change — `gattProfiles.ts` constants and `bleService.monitorCharacteristic` are consumed as-is; `bleService.ts` is deliberately left untouched (see Design decision above). |

## Implementation Steps

1. Add `src/interfaces/heartRate.ts` with `HeartRateSample` and `HeartRateSensorContact`.
2. Implement `src/services/ble/heartRateMeasurement.ts`: the local base64 decoder first
   (small, self-contained, no globals assumed), then `parseHeartRateMeasurement` per the
   flags-byte contract above.
3. Write `src/tests/services/ble/heartRateMeasurement.test.ts` with hand-built base64
   payloads covering: uint8 BPM path, uint16 BPM path (>255 bpm), sensor-contact not
   supported, sensor-contact supported+detected, sensor-contact supported+not-detected,
   energy-expended present, RR-intervals present (single and multiple values), all
   optional fields combined, truncated buffer (declares a flag but is missing its bytes),
   empty buffer, and invalid base64. Assert both the happy-path shape and that malformed
   inputs return `null` rather than throwing.
4. Implement `src/services/ble/heartRateMonitor.ts`'s `subscribeToHeartRate`, delegating
   to `bleService.monitorCharacteristic(HEART_RATE_SERVICE_UUID,
HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID, ...)` from `gattProfiles.ts`.
5. Write `src/tests/services/ble/heartRateMonitor.test.ts` using the existing manual mock
   (`__connectOutcome`, `__emitNotification`) to assert: a valid notification reaches
   `onSample` decoded; a malformed notification is dropped silently (`onSample` and
   `onError` both uncalled); calling the returned unsubscribe function stops further
   delivery; calling `subscribeToHeartRate` while not connected throws the same error
   `monitorCharacteristic` throws (no duplicated connection check).
6. Implement `src/hooks/useHeartRateMonitor.ts` per the contract above.
7. Write `src/tests/hooks/useHeartRateMonitor.test.ts` with
   `@testing-library/react-native`'s `renderHook`, driving the BLE mock through
   connect → `__emitNotification` → disconnect, asserting `sample` updates and then
   resets to `null`, and that unmounting calls the tracked unsubscribe (no leaked
   listener — reuse the "exactly-once" style assertion from `bleService.test.ts`).
8. Run `pnpm test`, `pnpm typecheck` (or `tsc --noEmit` if no dedicated script exists —
   confirm against `package.json`), and `pnpm lint` (oxlint) before considering the issue
   done.

## Style & Conventions

- `heartRateMeasurement.ts` has zero React/native imports, matching `CLAUDE.md`'s
  services layering rule and the "needs no mocks" testing guidance quoted for this exact
  file in the Testing section of `CLAUDE.md`.
- Test files mirror source 1:1 under `src/tests/...`, matching the existing
  `bleConnectionMachine.test.ts` / `bleService.test.ts` convention.
- `HeartRateSample`/`HeartRateSensorContact` live in `src/interfaces/`, not colocated in
  the service file, per the repo's `interfaces/` layering rule.
- `heartRateMonitor.ts` imports `bleService` (services → services is allowed; the
  layering contract only forbids `services/` importing React/`app/`/`components/`/
  `hooks/`/`store/`/`theme/`) and the new parser — no React import here either.
- `useHeartRateMonitor.ts` follows `useDevicePairing.ts`'s established
  `useSyncExternalStore(bleService.subscribe, bleService.getSnapshot)` pattern rather
  than introducing a second way to observe connection state.
- Per `CLAUDE.md`'s "Build for portability," `heartRateMeasurement.ts` is written so it
  could be copy-pasted into another project unchanged — no repo-specific imports, own
  base64 decoding, no assumption about the host runtime beyond standard JS.

## Acceptance Criteria

- [ ] `parseHeartRateMeasurement` correctly decodes: uint8 BPM, uint16 BPM (>255),
      sensor-contact not-supported/detected/not-detected, energy-expended present,
      single and multiple RR intervals, and any valid combination of the above flags.
- [ ] `parseHeartRateMeasurement` returns `null` (never throws, never emits a garbage
      BPM) for: empty payload, invalid base64, a flags byte declaring a field whose bytes
      are missing/short, and an RR-intervals tail with an odd leftover byte count.
- [ ] `subscribeToHeartRate` delivers only successfully-decoded samples to `onSample`;
      malformed notifications are dropped without invoking `onSample` or `onError`.
- [ ] `subscribeToHeartRate`'s returned unsubscribe function stops further delivery, and
      calling it while not connected throws the same error `bleService.monitorCharacteristic`
      throws today (no new/duplicated error message).
- [ ] `useHeartRateMonitor` exposes the latest sample while connected, resets to `null`
      on disconnect, and unsubscribes on unmount with no leaked listener across
      connect/disconnect/reconnect cycles.
- [ ] `pnpm test` passes, including every new test file, with no mocks required for
      `heartRateMeasurement.test.ts`.
- [ ] `pnpm lint` and the repo's type-check command pass with no new errors.

## Constraints

- **Android only** — no iOS-specific handling; not applicable here since this layer has
  no platform branching at all.
- Out of scope (left to later, not-yet-filed issues per Milestone 1.2's remaining
  bullets): the live workout screen itself, the elapsed session timer and
  Start/Pause/Resume/Stop controls, rolling-average BPM display, the mid-session
  reconnecting indicator, session-level stat reduction (avg/max/min), and the MET/HR
  calorie formula. This spec only produces the decoded per-notification sample and the
  means to subscribe to it.
- `energyExpended` and `rrIntervals` are per-notification, cumulative-since-device-reset
  and instantaneous respectively, per the Bluetooth GATT Heart Rate Measurement
  characteristic spec — no cross-notification aggregation happens in this layer.
- `bleService.ts` is not modified; if a future issue finds `monitorCharacteristic`'s
  contract insufficient for HR (e.g. needing per-characteristic disambiguation beyond
  what `__mocks__/react-native-ble-plx.ts` currently supports), that is out of scope
  here — the existing mock's characteristic-UUID-only matching is sufficient for this
  feature since only one characteristic is monitored at a time.
- No persistence: samples are not written to MMKV, Health Connect, or any store. HR
  session storage remains out of scope until session recording is specified.
