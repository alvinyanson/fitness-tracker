# Feature: Health Connect Setup + Availability Guard

## Intent

`react-native-health-connect` is installed and natively configured, and an
availability service tells the rest of the app whether writing to Health Connect is
currently possible (`available | needs-install | needs-update | unsupported`) so a
future write-back feature can sit behind it — the app records and saves sessions
identically whether or not Health Connect is usable on the device.

## Context

- **Problem statement:** `docs/specs.md` Milestone 2 (line 53) replaces the weather
  app's "cache + reconnect" story with "write completed sessions to Health Connect on
  Android" and explicitly warns Google Fit is deprecated and must not be used.
  `CLAUDE.md`'s "Domain conventions" section already commits to Health Connect as "the
  source of truth for aggregate body data," but no Health Connect code, dependency, or
  `app.json` entry exists in this repository yet (confirmed via `package.json` and
  `app.json` — neither lists `react-native-health-connect` or
  `expo-build-properties`). GitHub issue #15 is the prerequisite chore: get the library
  installed, natively configured, and gated behind an availability check, before any
  issue attempts to write an actual record.
- **Current code:** `src/app/settings.tsx` is the only settings surface today —
  a language picker rendered from `SUPPORTED_LOCALES`, styled inline with
  `StyleSheet.create` against `@/theme` tokens (`colors`, `type`, `space`, `radii`), no
  `ScrollView` (single section, fits on screen). `src/services/crashService.ts` exists
  and is used by `src/services/storage/mmkvStorage.ts` (wraps `getItem`) as the
  established "report through crashService, don't let it throw silently" pattern this
  issue's Notes section calls for. The closest structural precedent is
  `docs/specs/android-ble-permission-gate/SPEC.md` (issue #5): a device/OS capability
  that isn't guaranteed to be ready, gated by an explicit status union, a plain-TypeScript
  orchestrating service, a thin `hooks/` wrapper, and a presentational view — that shape
  is reused here for a different capability (an installed companion app instead of a
  runtime permission).
- **User impact:** Settings gains a Health Connect status section. On a device that has
  Health Connect and grants permission, it shows an "enabled" state. On a device missing
  it, on an outdated Health Connect, or on a device whose Android version can't run it
  at all, the section explains why and — for the two install-related cases — links to
  the Health Connect Play Store listing. In every case the rest of the app (BLE pairing,
  live workout, session save, history) is completely unaffected; this issue does not
  write a single Health Connect record, it only builds the gate a later write-back issue
  will sit behind, mirroring how issue #5 built the BLE gate before any scan/connect
  logic existed.
- **Dependencies:** Depends on #13 (session summary/MMKV persistence — closed, merged in
  #55) only in the sense that `docs/specs.md` sequences Health Connect after sessions are
  persisted; this issue does not touch `src/services/session/` or
  `src/services/storage/sessionHistoryStorage.ts`. Adds two new packages:
  `react-native-health-connect` and `expo-build-properties` (both installed via
  `npx expo install`, per `CLAUDE.md`). `expo-build-properties` is required because
  Health Connect's own docs (see below) call for `minSdkVersion: 26`, one above Expo
  SDK 56's default `minSdkVersion: 24` — without the plugin the native build stays at 24
  and the Health Connect module's own Gradle manifest merge will fail or silently
  under-declare. `app.json`'s `plugins`/`android.permissions` change is a **native config
  change: `npx expo prebuild --clean` (or `pnpm android`, which prebuilds implicitly) is
  required — a Metro reload will not pick it up**, per `CLAUDE.md`.

### Library facts confirmed via current docs (not memory)

- `getSdkStatus(providerPackageName?)` resolves to a status; the exported
  `SdkAvailabilityStatus` enum has exactly three members: `SDK_AVAILABLE`,
  `SDK_UNAVAILABLE`, `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED`. This is a 3-way status,
  not the issue's requested 4-way `available | needs-install | needs-update |
unsupported` — the fourth (`unsupported`) is this design's addition, derived from the
  Android version check below, not from the library.
- `initialize(providerPackageName?)` resolves `boolean` and must succeed before any
  read/write/permission call; it is not implied by `SDK_AVAILABLE` alone.
- `requestPermission(permissions: Permission[])` resolves the subset of the requested
  permissions actually granted; there is no separate "check granted permissions without
  prompting" call surfaced in these docs, so granted-state has to be inferred from
  comparing the requested array against the resolved array.
- The library's own `README` shows `expo-build-properties` set to
  `{ compileSdkVersion: 35, targetSdkVersion: 35, minSdkVersion: 26 }`. Expo SDK 56's own
  Gradle defaults (confirmed via the `expo` package's
  `ExpoRootProjectPlugin.defineDefaultProperties`) are `compileSdk=35`, `targetSdk=35`,
  `minSdk=24`. Only `minSdkVersion` needs raising; `compileSdkVersion`/`targetSdkVersion`
  already match Expo 56's default but are declared explicitly anyway, matching the
  library's own documented config verbatim rather than relying on the default staying at
  35 across a future Expo SDK bump.
- Health Connect permission strings for Expo's static `android.permissions` array follow
  `android.permission.health.READ_<TYPE>` / `WRITE_<TYPE>` (e.g.
  `READ_STEPS`/`WRITE_STEPS` per the library's `permissions.md`). No record type has been
  decided for the eventual session write-back yet — see Constraints — so this issue
  declares only `READ_EXERCISE`/`WRITE_EXERCISE`, the minimum pair needed to prove the
  end-to-end permission flow this issue is responsible for building.
- Through Android 13, Health Connect requires an `AndroidManifest.xml` activity
  responding to `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`; from Android 14 it
  requires an `activity-alias` named `ViewPermissionUsageActivity` targeting the main
  activity, gated by `android.permission.START_VIEW_PERMISSION_USAGE` and matching
  `android.intent.category.HEALTH_PERMISSIONS`. Neither is expressible through `app.json`
  fields directly — they require a config plugin's `withAndroidManifest` mod. The
  library ships no such plugin itself (its README plugin snippet references
  `"expo-health-connect"`, which does not exist as an installable package under that
  name and is not depended on here); this issue writes a small local plugin instead.

## Data Model

New types in `src/interfaces/healthConnect.ts`:

```ts
/** Whether the app can currently write to Health Connect. */
export type HealthConnectAvailability =
  'available' | 'needs-install' | 'needs-update' | 'unsupported';

/** Outcome of requesting a set of Health Connect record-type permissions. */
export type HealthConnectPermissionStatus = 'granted' | 'partial' | 'denied';
```

- `'unsupported'` means the OS itself cannot run Health Connect (Android < 9 / API 28);
  `'needs-install'` and `'needs-update'` are both recoverable by the user visiting the
  Play Store.
- `'partial'` covers requesting more than one permission and only some being granted
  (e.g. read allowed, write denied) — the caller decides whether that's usable for its
  feature; this service does not collapse it into `'granted'` or `'denied'`.
- No persistence. Availability and permission grants are both re-derived from the OS on
  every check — nothing here is written to MMKV, matching the BLE gate's "re-evaluate
  every time, never cache" precedent (adapter power and installed-app state can both
  change outside the app between checks).
- `HealthConnectAvailability` does not extend or merge with `BleGateStatus`
  (`src/interfaces/ble.ts`) — they gate two unrelated capabilities (a paired BLE device
  vs. an OS health store) and a session can be recorded and saved with either, both, or
  neither available, per `CLAUDE.md`'s "HR is optional per session" and this issue's own
  acceptance criteria.

## Interfaces / API

All service functions are plain async functions with no React import, under
`src/services/healthConnect/`, per `CLAUDE.md`'s layering contract. Every call into
`react-native-health-connect` is wrapped in `try/catch` reporting through
`src/services/crashService.ts` on an unexpected rejection — `CLAUDE.md`'s cross-cutting
crash-logging requirement explicitly names Health Connect calls now that this issue adds
them.

### `src/services/healthConnect/healthConnectAvailability.ts`

```ts
export async function getHealthConnectAvailability(): Promise<HealthConnectAvailability>;
```

- Non-Android platforms: returns `'unsupported'` immediately, no native call — mirrors
  `requestBlePermissions`'s cross-platform-safe early return in
  `src/services/ble/blePermissions.ts`.
- Android, `Platform.Version < 28` (Android 9/API 28, Health Connect's own OS floor):
  returns `'unsupported'` without calling `getSdkStatus` — Health Connect cannot run on
  this device regardless of what's installed, so there is nothing to link the user to in
  the Play Store.
- Android, `Platform.Version >= 28`: calls `getSdkStatus()`.
  - `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` → `'needs-update'`.
  - `SDK_UNAVAILABLE` → `'needs-install'`.
  - `SDK_AVAILABLE` → calls `initialize()`; `true` → `'available'`, `false` →
    `'needs-install'` (treat an unsuccessful initialize the same as not installed — the
    module isn't usable either way, and the library's own docs give no other reason
    `initialize` would resolve `false` on a device the SDK just reported as available).
- An unexpected thrown/rejected error from either native call is caught, reported via
  `reportError` with `{ scope: 'healthConnectAvailability' }`, and the function resolves
  `'unsupported'` (the safe, most restrictive outcome — never tell the caller
  write-back is possible when a native call just failed unexpectedly).

### `src/services/healthConnect/healthConnectPermissions.ts`

```ts
export async function requestHealthConnectPermissions(
  permissions: Permission[], // re-exported type from react-native-health-connect
): Promise<HealthConnectPermissionStatus>;
```

- Generic over the requested permission list — this issue does not hardcode a record
  type. Calls `requestPermission(permissions)`, compares the resolved granted array
  against the requested array by `(accessType, recordType)` pair:
  - every requested permission present in the granted array → `'granted'`
  - none present → `'denied'`
  - some but not all → `'partial'`
- Same catch/report/safe-default pattern as above: an unexpected rejection reports via
  `reportError` with `{ scope: 'healthConnectPermissions' }` and resolves `'denied'`.
- Does not call `getHealthConnectAvailability` or `initialize` itself — the hook below
  sequences availability-then-permission, matching the BLE gate's
  permission-then-adapter orchestration split between a hook and the services it calls.

### `src/hooks/useHealthConnectAvailability.ts`

```ts
export function useHealthConnectAvailability(): {
  availability: HealthConnectAvailability | 'checking';
  retry: () => void;
  requestPermissions: (
    permissions: Permission[],
  ) => Promise<HealthConnectPermissionStatus>;
  openPlayStoreListing: () => void;
};
```

- `useState<HealthConnectAvailability | 'checking'>('checking')` + an effect that calls
  `getHealthConnectAvailability()` on mount; `retry()` re-runs it (setting `'checking'`
  first), matching `useBlePermissionGate`'s transient-state pattern.
- `requestPermissions` is a passthrough to `requestHealthConnectPermissions` — the hook
  does not decide which permissions to request; that's the caller's concern (deferred to
  the eventual write-back feature, and to this issue's own permission-flow test/proof —
  see Constraints).
- `openPlayStoreListing()` calls `Linking.openURL` (from `react-native`, no new
  dependency, matching `useBlePermissionGate`'s choice of `react-native`'s `Linking` over
  `expo-linking`) against
  `market://details?id=com.google.android.apps.healthdata`, falling back to
  `https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata` if
  the `market://` scheme can't be opened (`Linking.canOpenURL` check first). Enabled by
  the view for `'needs-install'` and `'needs-update'` only; the hook itself doesn't gate
  the call, matching `openAppSettings`'s presentation-concern split in the BLE gate.

### `src/components/HealthConnectStatusCard.tsx`

```ts
export function HealthConnectStatusCard(props: {
  availability: HealthConnectAvailability | 'checking';
  onRetry: () => void;
  onOpenPlayStore: () => void;
}): JSX.Element;
```

- Presentational only, themed via `@/theme`, no hardcoded hex/size/radius, system font
  (no `fontFamily`) per the fonts-pending note — same constraints as
  `BlePermissionGateView`.
- Renders one status line + one description per `availability` value, plus:
  - `'needs-install'` / `'needs-update'`: an "Open Play Store" action calling
    `onOpenPlayStore` and a "Retry" action calling `onRetry` (re-checks in case
    the user just installed/updated/enabled it).
  - `'unsupported'` / `'available'` / `'checking'`: no action buttons.
- Always renders (never returns `null`) — unlike `BlePermissionGateView`, which blocks
  the whole pairing screen, this is one section of Settings and must show something even
  when `'available'` (a confirmation state), since Settings has no other Health Connect
  affordance yet.

## Files Created

| File                                                                 | Purpose                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/interfaces/healthConnect.ts`                                    | `HealthConnectAvailability`, `HealthConnectPermissionStatus` types.                          |
| `src/services/healthConnect/healthConnectAvailability.ts`            | Platform/API-level + SDK-status + initialize orchestration into one availability value.      |
| `src/services/healthConnect/healthConnectPermissions.ts`             | Wraps `requestPermission`, maps result to granted/partial/denied.                            |
| `src/hooks/useHealthConnectAvailability.ts`                          | React wrapper: state + retry + permission-request + Play Store link.                         |
| `src/components/HealthConnectStatusCard.tsx`                         | Presentational status section for Settings.                                                  |
| `plugins/withHealthConnectManifest.js`                               | Local Expo config plugin adding the rationale activity/activity-alias to the manifest.       |
| `__mocks__/react-native-health-connect.ts`                           | Scriptable mock: `getSdkStatus`, `initialize`, `requestPermission`, `SdkAvailabilityStatus`. |
| `src/tests/services/healthConnect/healthConnectAvailability.test.ts` | Platform/status-mapping/error-fallback tests.                                                |
| `src/tests/services/healthConnect/healthConnectPermissions.test.ts`  | Granted/partial/denied mapping + error-fallback tests.                                       |
| `src/tests/hooks/useHealthConnectAvailability.test.ts`               | Mount/retry/permission-request/Play-Store-link tests, service module mocked.                 |
| `src/tests/components/HealthConnectStatusCard.test.tsx`              | Renders correct copy/actions per availability value.                                         |

## Files Modified

| File                                     | Change                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                           | Add `react-native-health-connect` and `expo-build-properties` via `npx expo install` (versions pinned by the installer, not hand-typed).                                                                                                                                     |
| `app.json`                               | Add `expo-build-properties` plugin entry (`android: { compileSdkVersion: 35, targetSdkVersion: 35, minSdkVersion: 26 }`); add `./plugins/withHealthConnectManifest` to `plugins`; add `android.permission.health.READ_EXERCISE` / `WRITE_EXERCISE` to `android.permissions`. |
| `src/app/settings.tsx`                   | Render `HealthConnectStatusCard` (wired to `useHealthConnectAvailability`) as a new section below the language picker.                                                                                                                                                       |
| `src/services/i18n/translations/en.json` | Add a `healthConnect` key group (status copy, descriptions, action labels/hints — see Implementation Steps).                                                                                                                                                                 |
| `src/services/i18n/translations/ja.json` | Add the matching `healthConnect` key group with Japanese copy, keeping both files' key sets identical (`src/tests/services/i18n/localeCoverage.test.ts` already enforces this).                                                                                              |

## Implementation Steps

1. `npx expo install react-native-health-connect expo-build-properties`.
2. Add `src/interfaces/healthConnect.ts` with the two union types.
3. Write `plugins/withHealthConnectManifest.js`: a `withAndroidManifest` mod adding (a)
   the `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` intent-filter to the existing
   main activity, (b) the `.PermissionsRationaleActivity` activity + matching
   intent-filter, (c) the `ViewPermissionUsageActivity` activity-alias targeting the main
   activity, exactly as shown in the library's `permissions.md`. Export it as an Expo
   config plugin function (`withAndroidManifest`-wrapped, default export).
4. Update `app.json`: `expo-build-properties` plugin entry, `./plugins/withHealthConnectManifest`
   added to `plugins`, and the two `android.permission.health.*` entries added to
   `android.permissions` (leaving the existing BLE permissions untouched).
5. Add `__mocks__/react-native-health-connect.ts`: exports `SdkAvailabilityStatus` (the
   three real string/number members from the library), scriptable `getSdkStatus()`,
   `initialize()`, and `requestPermission()` functions with `__setSdkStatus(...)` /
   `__setInitializeResult(...)` / `__setGrantedPermissions(...)` test hooks, mirroring
   `__mocks__/react-native-ble-plx.ts`'s scripting pattern.
6. Implement `src/services/healthConnect/healthConnectAvailability.ts` per the contract
   above, importing `Platform` from `react-native` for the OS-version branch.
7. Write `src/tests/services/healthConnect/healthConnectAvailability.test.ts`: non-Android
   short-circuit; Android `< 28` short-circuit (no native call made — assert the mock
   wasn't invoked); each `SdkAvailabilityStatus` mapping; `SDK_AVAILABLE` +
   `initialize() → false` maps to `'needs-install'`; a thrown error from `getSdkStatus`
   is caught, reported (assert `reportError` called, `crashService` mocked), and resolves
   `'unsupported'`.
8. Implement `src/services/healthConnect/healthConnectPermissions.ts`.
9. Write `src/tests/services/healthConnect/healthConnectPermissions.test.ts`: all
   requested permissions granted; none granted; a mixed result → `'partial'`; a thrown
   error is caught/reported and resolves `'denied'`.
10. Implement `src/hooks/useHealthConnectAvailability.ts`.
11. Write `src/tests/hooks/useHealthConnectAvailability.test.ts` (service module mocked
    via `jest.mock`): mounts into `'checking'` then resolves; `retry()` re-enters
    `'checking'`; `openPlayStoreListing()` calls `Linking.openURL` with the `market://`
    URI first, falling back to the `https://` URL when `canOpenURL` resolves `false`
    (`Linking` mocked).
12. Implement `src/components/HealthConnectStatusCard.tsx`, theming via `@/theme` only,
    with `accessibilityRole`/`accessibilityLabel`/`accessibilityHint`/`accessibilityState`
    on the Retry/Open-Play-Store actions matching `BlePermissionGateView`'s pattern.
13. Write `src/tests/components/HealthConnectStatusCard.test.tsx`: one case per
    `availability` value, asserting the right copy key renders and the right actions
    are present/absent (no action row for `'unsupported'`; Play Store action only for
    `'needs-install'`/`'needs-update'`).
14. Add the `healthConnect` key group to `src/services/i18n/translations/en.json`
    (`title`, `statusAvailable`, `statusNeedsInstall`, `statusNeedsUpdate`,
    `statusUnsupported`, `statusChecking`, `needsInstallDescription`,
    `needsUpdateDescription`, `unsupportedDescription`, `availableDescription`,
    `checkingDescription`, `openPlayStore`, `openPlayStoreHint`, `retry`,
    `retryHint`) and the identical key set with Japanese copy to `ja.json`.
15. Wire `src/app/settings.tsx`: call `useHealthConnectAvailability()`, render
    `HealthConnectStatusCard` as a second section.
16. `npx expo prebuild --clean` (or `pnpm android`) to regenerate `android/` with the new
    manifest entries, build config, and permissions; confirm the app still launches and
    the existing BLE pairing flow is unaffected.
17. Manually verify on/with an emulator or device both with and without the Health
    Connect app installed (acceptance criteria below), then run the verification
    commands.

## Style & Conventions

- Layering: `services/healthConnect/*` has no React import and imports nothing from
  `app/`, `components/`, `hooks/`, `store/`, or `theme/`, per `CLAUDE.md`.
  `components/HealthConnectStatusCard.tsx` never imports a service directly — it takes
  `availability`/callbacks as props from the hook, per the `app → components → hooks →
services` layering contract.
- `HealthConnectAvailability`/`HealthConnectPermissionStatus` live in
  `src/interfaces/`, matching `src/interfaces/ble.ts`'s precedent, not a local `types/`
  file.
- Test files mirror source paths 1:1 under `src/tests/`, matching the existing
  `src/tests/services/ble/...` convention.
- The Health Connect mock stays at the repo-root `__mocks__/react-native-health-connect.ts`
  single file, matching how `__mocks__/react-native-ble-plx.ts` is the one BLE mock
  rather than inline per-test `jest.mock()` bodies.
- Every native Health Connect call is wrapped and reported through
  `src/services/crashService.ts`'s `reportError`, per `CLAUDE.md`'s cross-cutting
  crash-logging requirement — this is a deliberate difference from
  `src/services/ble/blePermissions.ts`, which lets an unexpected `PermissionsAndroid`
  rejection propagate uncaught; that choice predates Health Connect's explicit mention in
  `CLAUDE.md`'s crash-logging bullet and is not revisited here.
- `HealthConnectAvailability` is an explicit string union, not booleans, per
  `CLAUDE.md`'s "every new async flow follows this shape" domain convention.
- No hardcoded hex/font-size/radius in `HealthConnectStatusCard.tsx`; system font only
  (fonts pending).
- Every new interactive element gets `accessibilityRole`/`accessibilityLabel`/
  `accessibilityHint`/`accessibilityState`, matching `BlePermissionGateView`'s and
  `settings.tsx`'s existing pattern.
- No hardcoded user-facing string; all copy routed through `useTranslation`'s `t(...)`,
  added to both `en.json` and `ja.json`.

## Acceptance Criteria

- [ ] `getHealthConnectAvailability()` returns `'unsupported'` on non-Android and on
      Android `< 28`, without calling any native Health Connect function in either case.
- [ ] `getHealthConnectAvailability()` maps `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` →
      `'needs-update'`, `SDK_UNAVAILABLE` → `'needs-install'`, and `SDK_AVAILABLE` +
      successful `initialize()` → `'available'`.
- [ ] `requestHealthConnectPermissions()` returns `'granted'`, `'partial'`, or `'denied'`
      correctly for full, mixed, and empty grant results.
- [ ] An unexpected rejection from any native call is reported through
      `crashService.reportError` and resolves to the documented safe default
      (`'unsupported'` / `'denied'`), never an unhandled rejection.
- [ ] `HealthConnectStatusCard` renders distinct copy for all four availability values
      plus `'checking'`, with a Play Store action only for `'needs-install'`/
      `'needs-update'` and no action row for `'unsupported'`.
- [ ] Fresh dev-client build (`npx expo prebuild --clean` then `pnpm android`) launches
      on a device with Health Connect installed and, after `requestPermissions` is
      exercised for `READ_EXERCISE`/`WRITE_EXERCISE`, `getHealthConnectAvailability()`
      reports `'available'`.
- [ ] On a device/emulator without Health Connect installed, the app still records and
      saves sessions end-to-end (BLE pairing → live workout → Stop → summary); the
      Settings section shows `'needs-install'` with a visible reason and a working Play
      Store link, and nothing else in the app is degraded.
- [ ] `pnpm test` passes, including all new suites, with `react-native-health-connect`
      fully mocked — no real native module or device state touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `src/tests/services/i18n/localeCoverage.test.ts` still passes with the new
      `healthConnect` key group present in both `en.json` and `ja.json`.

## Constraints

- Android only, per `CLAUDE.md` — no HealthKit, no iOS branch, no `ios` block additions
  to `app.json`, despite `docs/specs.md` mentioning an iOS path.
- No Health Connect record is read or written by this issue. `READ_EXERCISE`/
  `WRITE_EXERCISE` are declared and requested only to prove the availability +
  permission-request flow end-to-end (acceptance criteria); the actual session
  write-back (which record types beyond exercise — heart rate, active calories — and
  when it runs relative to Stop) is separate, not-yet-filed work that sits behind this
  gate, mirroring how the BLE permission gate (#5) preceded the scan/connect flow.
- No steps or body-weight read/write here despite `CLAUDE.md` naming Health Connect as
  their source of truth — those are separate features (calorie estimation, weight
  tracking) not yet scoped, per `docs/specs.md`'s Milestone 3/stretch section.
- No live "Health Connect was just installed while Settings is open" listener — like the
  BLE adapter-state check, this is point-in-time, re-evaluated on mount and on explicit
  Retry only.
- `google.android.apps.healthdata` (the default Health Connect provider package) is
  hardcoded as the target of the Play Store link and the implicit default for
  `getSdkStatus`/`initialize` — no alternate-provider support, since none is documented
  as relevant to a standard Android device in this project's scope.
- Raising `minSdkVersion` from Expo 56's default of `24` to `26` drops support for
  Android 7.0/7.1 (API 24–25) devices for the whole app, not just the Health Connect
  path — accepted here because the library's docs require it and there is no
  Health-Connect-only way to scope a `minSdkVersion` bump in Gradle.
- `app.json` plugin/permission/build-properties changes require a native rebuild
  (`npx expo prebuild --clean` then `pnpm android`) — a Metro/dev-client reload alone
  will not apply them, and `expo run:android`'s implicit prebuild may not detect a
  config-only change if `android/` (gitignored, already present locally) is stale.
- The library's README plugin snippet naming a plugin called `"expo-health-connect"` is
  not followed — no such package is added; the manifest changes it implies are done via
  the local `plugins/withHealthConnectManifest.js` plugin instead.
