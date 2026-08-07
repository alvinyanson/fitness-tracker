# Feature: Android 12+ Runtime BLE Permission Gate on Entry

## Intent

The pairing screen checks BLE runtime permissions and the Bluetooth adapter state before
any scan is attempted, and shows an explanatory, retryable screen for every non-granted
outcome (denied, permanently denied, adapter off) instead of a silently empty scan list.

## Context

- **Problem statement:** `docs/specs.md` Milestone 1.1 (line 17) requires BLE permission
  handling on entry. GitHub issue #5 describes this as covering the denial paths of an
  existing `src/services/ble/blePermissions.ts` (~40 lines). That file does not exist in
  this repository — confirmed via `Glob`/directory listing, `src/services/` currently
  contains only `formatDuration.ts` and `storage/`. This is greenfield work, not a
  modification. `app.json` today declares no BLE permissions and no
  `react-native-ble-plx` config plugin — `CLAUDE.md`'s "Native config" section flags this
  gap explicitly and names this as the issue that should close it.
- **Current code:** `src/app/index.tsx` (the pairing screen) is a stub: a title and two
  `Link`s to `/workout` and `/history`, no scan/connect logic, no permission awareness.
  `react-native-ble-plx` is already a dependency (`package.json`, devDependencies,
  `^3.5.1`) and already has a Jest mock at `__mocks__/react-native-ble-plx.ts` (a scripted
  `BleManager`/`Device` pair covering scan results, connect outcomes, notifications, and
  disconnects — but no adapter-state methods yet). No `src/hooks/` or `src/store/`
  directory exists yet; this issue is the first consumer of `src/hooks/`.
- **User impact:** Opening the app with BLE permissions unresolved or Bluetooth off now
  shows a clear, actionable message with a retry (and, where applicable, an
  "Open Settings") action, instead of proceeding to a scan step that silently finds
  nothing. This issue does not add the scan step itself — no scan/connect flow exists
  anywhere in the repo yet — it adds the gate that a later scan-flow issue will sit
  behind.
- **Dependencies:** `react-native-ble-plx` (present) is used only for its `BleManager`
  adapter-state query, not for scanning (out of scope here). No new packages required.
  This issue also closes the `app.json` gap `CLAUDE.md` flags: adding
  `react-native-ble-plx`'s Expo config plugin and the runtime permissions is a **native
  config change and requires `npx expo prebuild --clean` (or `pnpm android`, which
  prebuilds implicitly) — a Metro reload will not pick it up.**

### Conflict flagged: issue vs. `docs/specs.md`

`docs/specs.md` line 17 says permission handling covers "Android 12+ ... BLUETOOTH_SCAN/
BLUETOOTH_CONNECT ... iOS requires NSBluetoothAlwaysUsageDescription." Issue #5's own
notes and `CLAUDE.md`'s non-negotiables both override this: **no iOS work**. The
reference snippet the user supplied (for context only, not implemented as shown) has an
iOS branch and an iOS-permission comment; this spec strips that branch entirely — the
service only ever runs the Android path, and returns `'granted'` immediately (no
Bluetooth/permission calls at all) on any non-Android platform so the module never
breaks if it is ever imported in a cross-platform test context. There is otherwise no
conflict: the Android 12+ split and the pairing-screen-mirrors-weather-app framing both
match this design.

## Data Model

New types in `src/interfaces/ble.ts`:

```ts
/** Outcome of requesting the Android runtime BLE permissions. */
export type BlePermissionStatus = 'granted' | 'denied' | 'blocked';

/** Bluetooth adapter power state, collapsed from react-native-ble-plx's `State` enum. */
export type BluetoothAdapterStatus = 'poweredOn' | 'poweredOff' | 'unknown';

/**
 * Combined gate the pairing screen renders against. `'checking'` is the initial/retry
 * transient; every other value is terminal until the user acts (retry or Settings).
 */
export type BleGateStatus =
  | 'checking'
  | 'ready'
  | 'permissionDenied'
  | 'permissionBlocked'
  | 'bluetoothOff';
```

- `BlePermissionStatus.blocked` means at least one requested permission came back
  `never_ask_again` from `PermissionsAndroid` — the OS will not show the prompt again
  until the user changes it in system Settings.
- `BleGateStatus` is a distinct concept from `CLAUDE.md`'s connection-state union
  (`idle | scanning | connecting | connected | disconnected | error`) — that union
  describes the BLE link once scanning starts; this one describes whether the app is
  even allowed to try. They compose (gate must be `'ready'` before connection state
  leaves `'idle'`) but are not the same enum, and this issue does not touch the
  connection-state union or any scan/connect logic.
- No persistence, no database change. Nothing here is stored — the gate is
  re-evaluated every time the pairing screen mounts and on every retry, since permission
  grants and adapter power state can both change outside the app between checks.

## Interfaces / API

All three service functions are plain async functions, no React import, under
`src/services/ble/`, per `CLAUDE.md`'s layering contract and the issue's explicit
"keep the logic React-free" note.

### `src/services/ble/blePermissions.ts`

```ts
export async function requestBlePermissions(): Promise<BlePermissionStatus>;
```

- Non-Android platforms: returns `'granted'` immediately, no `PermissionsAndroid` call.
  (No iOS branch — Android is the only supported platform; this early return exists so
  the module doesn't crash if ever imported where `Platform.OS !== 'android'`, e.g. a
  future web target per `docs/specs.md` Milestone 2, not to add iOS behavior.)
- Android, `Platform.Version >= 31` (Android 12+): calls
  `PermissionsAndroid.requestMultiple([BLUETOOTH_SCAN, BLUETOOTH_CONNECT])`. Does **not**
  request `ACCESS_FINE_LOCATION` on this branch — Android 12+ does not require location
  for BLE scanning when the manifest declares `neverForLocation` (this spec's `app.json`
  plugin config sets it false by default per the library's own experimental-flag
  warning, so re-verify this exclusion against the installed
  `react-native-ble-plx` config-plugin behavior during implementation; if the
  installed plugin version still ties `ACCESS_FINE_LOCATION` to the manifest
  unconditionally, request it here too). Maps the two results:
  - both `granted` → `'granted'`
  - either `never_ask_again` → `'blocked'` (never_ask_again takes priority over a plain
    denial from the other permission)
  - otherwise (either plain `denied`) → `'denied'`
- Android, `Platform.Version < 31`: calls
  `PermissionsAndroid.request(ACCESS_FINE_LOCATION, {...})` with the rationale copy from
  the reference snippet (title/message/button copy may be reused verbatim — it is plain
  UI string content, not the iOS-touching logic this spec strips). Maps: `granted` →
  `'granted'`; `never_ask_again` → `'blocked'`; `denied` → `'denied'`.
- Never throws for a normal deny/block outcome — `PermissionsAndroid` resolves rather
  than rejects for those. A native-level rejection (unexpected) propagates to the caller
  uncaught; the gate orchestrator (below) does not add its own try/catch, so an
  unexpected rejection surfaces as an unhandled promise rejection during development
  rather than being silently swallowed into `'denied'`.

### `src/services/ble/bluetoothAdapter.ts`

```ts
export async function getBluetoothAdapterStatus(): Promise<BluetoothAdapterStatus>;
```

- Constructs a `BleManager` (from `react-native-ble-plx`) and calls `.state()`, mapping
  `State.PoweredOn` → `'poweredOn'`, `State.PoweredOff` → `'poweredOff'`, anything else
  (`Unknown`, `Unauthorized`, `Resetting`, `Unsupported`) → `'unknown'`.
- A short-lived `BleManager` instance is created per call and not retained — this
  function is a point-in-time check, not a subscription. Live adapter-state monitoring
  (reacting to the user toggling Bluetooth while the pairing screen is already open,
  without hitting Retry) is explicitly out of scope for this issue (see Constraints);
  the acceptance criterion "toggling Bluetooth off shows a distinct message" is met by
  re-evaluating on mount/retry, not by a live listener.

### `src/services/ble/blePermissionGate.ts`

```ts
export async function evaluateBlePermissionGate(): Promise<BleGateStatus>;
```

- Orchestrates the two functions above into one `BleGateStatus`, so all branching logic
  is unit-testable without React:
  1. `requestBlePermissions()` — if `'blocked'` → return `'permissionBlocked'`; if
     `'denied'` → return `'permissionDenied'` (permission is checked first; an
     adapter-off state behind a denied permission is not distinguishable to the user
     yet and permission is the more actionable of the two).
  2. Only if permissions are `'granted'`: `getBluetoothAdapterStatus()` — if
     `'poweredOff'` → return `'bluetoothOff'`; if `'unknown'` → return `'bluetoothOff'`
     as well (treat "can't confirm it's on" the same as "off" — never tell the user
     they're ready to scan when the adapter state is unconfirmed).
  3. Otherwise → `'ready'`.

### `src/hooks/useBlePermissionGate.ts`

```ts
export function useBlePermissionGate(): {
  status: BleGateStatus;
  retry: () => void;
  openAppSettings: () => void;
};
```

- Thin React wrapper: `useState<BleGateStatus>('checking')` +
  `useEffect`/callback that calls `evaluateBlePermissionGate()` on mount and stores the
  result; `retry()` re-runs the same evaluation (setting `'checking'` first so the UI can
  show a transient state, matching the weather app's detecting-location pattern
  `CLAUDE.md` references).
- `openAppSettings()` calls `Linking.openSettings()` (from `react-native`, no new
  dependency) unconditionally — it is only rendered/enabled by the view component when
  `status === 'permissionBlocked'`, but the hook itself doesn't gate the call; that's a
  presentation concern.
- No retry loop or polling — a single evaluation per mount/explicit retry, matching the
  point-in-time contract of `evaluateBlePermissionGate`.

### `src/components/BlePermissionGateView.tsx`

```ts
export function BlePermissionGateView(props: {
  status: Exclude<BleGateStatus, 'ready'>;
  onRetry: () => void;
  onOpenSettings: () => void;
}): JSX.Element;
```

- Presentational only, themed via `@/theme` (no hardcoded hex/size per `CLAUDE.md`'s UI
  rules; system font, no custom `fontFamily`, per the "fonts are pending" note).
- Renders one of four copy blocks (`'checking'` / `'permissionDenied'` /
  `'permissionBlocked'` / `'bluetoothOff'`) each with its own message and one action
  button: Retry for `checking`/`permissionDenied`/`bluetoothOff`, "Open Settings" for
  `permissionBlocked` (calling `onOpenSettings`, not `onRetry` — the user has to leave
  the app to fix this one).
- Copy is distinct per acceptance criteria: `permissionDenied` and `bluetoothOff` must
  not share wording (issue: "distinct message from the permission-denied one").

## Files Created

| File                                               | Purpose                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/interfaces/ble.ts`                            | `BlePermissionStatus`, `BluetoothAdapterStatus`, `BleGateStatus` types. |
| `src/services/ble/blePermissions.ts`               | Android runtime permission request + result-decision logic.             |
| `src/services/ble/bluetoothAdapter.ts`             | Point-in-time Bluetooth adapter power-state check.                      |
| `src/services/ble/blePermissionGate.ts`            | Orchestrates the two services above into one `BleGateStatus`.           |
| `src/hooks/useBlePermissionGate.ts`                | React wrapper: state + retry + open-settings action.                    |
| `src/components/BlePermissionGateView.tsx`         | Presentational blocked/denied/off screen with retry/settings CTA.       |
| `src/tests/services/ble/blePermissions.test.ts`    | Decision-logic tests, `PermissionsAndroid` mocked.                      |
| `src/tests/services/ble/bluetoothAdapter.test.ts`  | State-mapping tests against the existing BLE mock's `state()`.          |
| `src/tests/services/ble/blePermissionGate.test.ts` | Orchestration tests (permission-first, adapter-second precedence).      |

## Files Modified

| File                                | Change                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.json`                          | Add `android.permissions` (or the `react-native-ble-plx` config plugin, which derives them) for `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION`; no iOS plugin options set. |
| `__mocks__/react-native-ble-plx.ts` | Add a scriptable `state(): Promise<State>` (default `PoweredOn`) and a `__setAdapterState(state)` test hook to `BleManager`, mirroring the existing `__scanResults`/`__connectOutcome` scripting pattern.                 |
| `src/app/index.tsx`                 | Call `useBlePermissionGate()`; render `BlePermissionGateView` for every non-`'ready'` status, existing stub content only when `'ready'`.                                                                                  |

## Implementation Steps

1. Add `src/interfaces/ble.ts` with the three union types.
2. Add `app.json`'s `android.permissions` array (or the `react-native-ble-plx` plugin
   entry with `isBackgroundEnabled: false`, `neverForLocation: false`,
   `bluetoothAlwaysPermission: false` to suppress any iOS Info.plist string) — confirm
   against the installed `react-native-ble-plx@^3.5.1` plugin source which permissions
   it emits by default before deciding between the plugin and a manual permissions list.
3. Extend `__mocks__/react-native-ble-plx.ts`: add `State.Unauthorized` if not already
   covered by the existing enum (it currently has `Unknown`/`PoweredOn`/`PoweredOff` —
   add any missing member only if a test needs it), a `state()` method returning a
   scriptable current state (default `PoweredOn`), and a `__setAdapterState(state)`
   helper.
4. Implement `src/services/ble/blePermissions.ts` per the contract above.
5. Write `src/tests/services/ble/blePermissions.test.ts` mocking `PermissionsAndroid`
   (via `jest.mock('react-native', ...)` partial mock or RN's built-in Jest preset
   mock — confirm which `jest-expo` already provides): cover Android 12+ both-granted,
   one-denied, one-never-ask-again; pre-31 granted/denied/never-ask-again; non-Android
   short-circuit.
6. Implement `src/services/ble/bluetoothAdapter.ts` against the (now-extended) BLE mock.
7. Write `src/tests/services/ble/bluetoothAdapter.test.ts`: `PoweredOn` → `'poweredOn'`,
   `PoweredOff` → `'poweredOff'`, `Unknown` → `'unknown'`.
8. Implement `src/services/ble/blePermissionGate.ts`.
9. Write `src/tests/services/ble/blePermissionGate.test.ts`: denied-permission short
   circuits before adapter check is even called (assert the adapter mock is _not_
   invoked); blocked-permission likewise; granted-permission + adapter-off →
   `'bluetoothOff'`; granted + adapter-on → `'ready'`.
10. Implement `src/hooks/useBlePermissionGate.ts`.
11. Implement `src/components/BlePermissionGateView.tsx`, theming via `@/theme` only.
12. Wire `src/app/index.tsx`: render the gate view for non-`'ready'` statuses, existing
    stub `Link`s only once `'ready'`.
13. Run verification commands (below); if `app.json` changed, rebuild with
    `npx expo prebuild --clean` before `pnpm android` to confirm the manifest actually
    picks up the new permissions (`pnpm test`/`pnpm typecheck`/`pnpm lint` alone won't
    catch a manifest-generation problem).

## Style & Conventions

- Layering: `services/ble/*` has no React import and no import from `app/`,
  `components/`, `hooks/`, `store/`, or `theme/`, per `CLAUDE.md`. `hooks/` is the first
  file in that directory; `components/BlePermissionGateView.tsx` imports the hook's
  output type only (via `interfaces/`), never a service directly, per the
  `app → components → hooks → services` layering contract.
- `BlePermissionStatus`/`BluetoothAdapterStatus`/`BleGateStatus` live in
  `src/interfaces/`, not a local `types/` file, matching `src/interfaces/storage.ts`'s
  precedent.
- Test files mirror source paths 1:1 under `src/tests/`, matching
  `src/tests/services/storage/mmkvStorage.test.ts`'s existing convention
  (`src/tests/services/ble/...` for `src/services/ble/...`).
- The BLE mock stays at the repo-root `__mocks__/react-native-ble-plx.ts` single file,
  extended rather than duplicated, matching how `mmkv-storage-layer`'s spec added a
  sibling mock file instead of inline `jest.mock()`.
- No hardcoded hex/font-size/radius in `BlePermissionGateView.tsx` — theme tokens only,
  system font (no `fontFamily`) since custom fonts are still pending per `CLAUDE.md`.
- Connection-state-shaped union (explicit strings, not booleans) is followed for
  `BleGateStatus`, per `CLAUDE.md`'s domain convention that "every new async flow
  follows this shape."

## Acceptance Criteria

- [ ] `requestBlePermissions()` on Android 12+ requests exactly `BLUETOOTH_SCAN` and
      `BLUETOOTH_CONNECT`, not `ACCESS_FINE_LOCATION` (pending the manifest-behavior
      check in step 2/13) and returns `'granted'` only when both are granted.
- [ ] `requestBlePermissions()` returns `'blocked'` whenever any requested permission
      comes back `never_ask_again`, taking priority over a plain `denied` on another
      permission in the same call.
- [ ] `requestBlePermissions()` on pre-Android-12 requests only `ACCESS_FINE_LOCATION`
      and maps its three possible results correctly.
- [ ] `getBluetoothAdapterStatus()` correctly maps `PoweredOn`/`PoweredOff`/anything-else
      to `'poweredOn'`/`'poweredOff'`/`'unknown'`.
- [ ] `evaluateBlePermissionGate()` never calls the adapter check when permissions are
      not `'granted'` (denied/blocked short-circuit).
- [ ] Denying at the prompt (`'permissionDenied'`) renders `BlePermissionGateView` with a
      retry action, not the existing stub pairing content and not an empty scan list
      (there is no scan list yet in this repo, but the pairing screen's normal content
      must not render either).
- [ ] `'permissionBlocked'` renders an "Open Settings" action that calls
      `Linking.openSettings()`.
- [ ] `'bluetoothOff'` renders wording distinct from `'permissionDenied'`'s copy.
- [ ] `pnpm test` passes, including all new suites, with `PermissionsAndroid` and
      `react-native-ble-plx` mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- Android only, per `CLAUDE.md` — no iOS branch, no `NSBluetoothAlwaysUsageDescription`
  work, no `ios` block additions to `app.json`, despite `docs/specs.md` mentioning both.
- No scan/connect flow in this issue. `src/app/index.tsx` keeps its current stub Links
  once the gate resolves to `'ready'` — building the actual device scan UI is separate,
  not-yet-filed work that will sit behind this gate.
- No live Bluetooth-adapter-state subscription. The gate is point-in-time, evaluated on
  mount and on explicit retry; a listener that reacts to the user toggling Bluetooth
  while the screen stays open is out of scope and can be added when the scan flow needs
  it.
- No persistence of gate status — nothing here is written to MMKV or any store.
- This is new code, not a migration or a denial-path addition to an existing
  `blePermissions.ts` — no such file exists in this repository despite the issue and the
  reference snippet implying otherwise.
- The reference implementation supplied for this issue is context only. Its iOS branch
  and iOS-facing comments are not carried into this design; only its Android
  request/mapping shape and rationale-dialog copy are reused.
- `app.json` plugin/permission changes require a native rebuild
  (`npx expo prebuild --clean` then `pnpm android`) — a Metro/dev-client reload alone
  will not apply them, and `expo run:android`'s implicit prebuild may not detect a
  config-only change if `android/` (gitignored, already present locally) is stale.
