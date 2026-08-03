@AGENTS.md

# Fitness Tracker

React Native / Expo SDK 56 app that pairs with a standard BLE Heart Rate device
(GATT service `0x180D`), records live workout sessions, and later writes them back
to Health Connect. Full requirements live in `docs/specs.md` — read it before
planning any feature work.

**Android is the only supported platform.** iOS is explicitly out of scope: do not
write iOS-specific code, do not add iOS-only packages, do not add `ios` blocks to
`app.json`, and do not spend effort on HealthKit, Apple Sign-In, SF Symbols, or
CoreMotion. When `docs/specs.md` describes an iOS path alongside an Android one, take
the Android one and ignore the rest. The existing `ios` config in `app.json` is
inherited scaffolding — leave it alone, but do not extend it.

**Hard constraint: no custom backend.** Everything lives on-device, in Health Connect,
or in a BaaS you *configure* (Firebase). Never propose writing a server, an API layer,
or a sync protocol.

**Build for portability.** Feature modules should be liftable into another project:
generic logic in the middle, app-specific wiring at the edges. If something can't be
written that way, say so and say why.

## Non-negotiables

- **Expo SDK 56 only.** Read `https://docs.expo.dev/versions/v56.0.0/` for the exact
  versioned API before writing code. Do not rely on memory of older SDKs.
- **Expo Go does not work here.** `react-native-ble-plx` (and later MMKV, Firebase,
  Health Connect) are native modules. Development runs on a dev client via
  `expo run:android`. Never suggest a fix that assumes Expo Go.
- **New Architecture is on** (RN 0.85 / React 19). Reject packages that are old-arch only.
- **Install with pnpm**, and pin Expo-managed packages via `npx expo install` so
  versions stay SDK-56-compatible.

## Commands

```bash
pnpm start            # Metro (dev client, not Expo Go)
pnpm android          # expo run:android — required for BLE
pnpm test             # jest-expo
```

`pnpm ios` and `pnpm web` remain in `package.json` from the template. Neither is a
supported target; don't use them to validate a change.

## Layout

Target structure under `src/` (placeholder — still being shaped, confirm before
relying on it):

```
app/            # expo-router routes
components/
contexts/       # if any
hooks/
interfaces/
services/
store/
tasks/          # if any
theme/
utils/
```

Keep the layering strict regardless of how the tree settles: `services/` is plain
TypeScript with no React imports, so it stays portable and unit-testable. `hooks/`
adapts services to React. `components/` never talks to a service directly.

## Testing

`jest-expo` is the test runner — it is the officially supported preset for Expo SDK 56
and handles the React Native module/transform resolution that plain Jest does not.

- `jest-expo` preset + `@testing-library/react-native` for component tests.
- Highest-value coverage is the pure logic in `services/`: HR characteristic parsing,
  session stat reduction (avg/max/min), and later the MET/HR calorie math. Those need
  no mocks — keep them free of React and native imports so they stay that way.
- Mock `react-native-ble-plx` at the module boundary; never test against real hardware
  in CI.
- Maestro covers E2E in Milestone 2. It cannot drive real BLE hardware, so scope it to
  manual-entry and history flows.

## Tech stack

**Do not add a deferred package until its milestone starts.**

### Adopted now (Milestone 1)

| Package | Why |
|---|---|
| `expo` 56 / `react-native` 0.85 / `react` 19 | Baseline |
| `expo-router` | Four+ screens with a list→detail flow (History → Summary). File routing earns its keep here. |
| `react-native-ble-plx` | Mature scanning/connect/notify. Already wired. |
| `zustand` | Workout session state machine + settings. Small, no boilerplate. |
| `react-native-mmkv` | Synchronous KV. Persistence middleware for Zustand. |
| `expo-keep-awake` | The live workout screen must not sleep mid-session. |
| `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context` | Required by expo-router; also the animated BPM readout. |
| `jest-expo`, `@testing-library/react-native` | See Testing. |
| `oxlint`, `prettier`, `husky`, `lint-staged` | Lint, format, pre-commit gate. |

### Deferred to Milestone 2

| Package | Trigger |
|---|---|
| `react-native-health-connect` | Session write-back to the health store. Google Fit is deprecated — never use it. |
| `expo-build-properties` | Health Connect needs an explicit `minSdkVersion` / `compileSdkVersion`; check the library's current requirements when you add it. |
| `@react-native-firebase/app` + `auth` + `firestore` | Google login, cloud sync of units + language only. |
| `@react-native-google-signin/google-signin` | The one login provider in scope. |
| `@react-native-community/netinfo` | Offline/online indicator, only meaningful once network calls exist. |
| `i18n-js` + `expo-localization` | Translation module. |
| `react-native-svg` | HR-over-time chart on the summary screen. (`recharts` in the spec is web-only — ignore it.) |
| `@react-native-firebase/crashlytics` | Optional; nearly free once Firebase is in. |
| Maestro | E2E, scoped per Testing above. |

### Deferred to Milestone 3

`expo-secure-store` + `expo-auth-session` (Strava OAuth tokens), `expo-location` +
`expo-task-manager` (route sampling), `react-native-maps` or `@rnmapbox/maps`
(polyline redraw), `expo-sqlite` (see storage note), TanStack Query (only if Strava's
REST API actually lands — nothing before M3 has server state worth caching).

### Storage note

MMKV holds key-value data: last-paired device, units, language, user weight, session
index. `@react-native-async-storage/async-storage` is still a dependency and still backs
the last-paired-device store — migrate it to MMKV and drop the package; don't add new
call sites.

Move session **time series** (per-second HR samples, GPS points, altitude) to
`expo-sqlite` when Milestone 3 route tracking lands — JSON blobs in MMKV will not hold
up at that volume. Keep the storage layer as the seam so that swap stays local.

## Domain conventions

- **Connection state is an explicit union**, not booleans: `idle | scanning |
  connecting | connected | disconnected | error`. Every new async flow follows this
  shape.
- **A disconnect never kills an active session.** Show a reconnecting indicator and keep
  the timer running. BLE drops are routine.
- **HR is optional per session.** Design every stat, and the calorie formula, to work
  with zero HR samples — fall back to the pure MET formula. Not every user has a device.
- **Sessions save locally the moment the user hits Stop**, before any sync or health-store
  write is attempted.
- **Storage keys are namespaced** `@fitness_tracker/<name>`.
- **Health Connect is the source of truth for aggregate body data** — steps and body
  weight are read from and written to it rather than tracked separately.
- **Altitude comes from GPS** (M3). Android barometer availability is inconsistent across
  devices, so the noisier GPS altitude that already arrives with route coordinates is the
  reliable option.

## Native config

`app.json` permissions must stay in sync with any new native module. Currently:
`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH`, `BLUETOOTH_ADMIN`,
`ACCESS_FINE_LOCATION`, plus the `react-native-ble-plx` plugin.

- Android 12+ requires `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` as **runtime** permissions —
  declaring them in the manifest is not enough.
- Health Connect (M2) adds its own permission set and config plugin, and requires the
  Health Connect app/module present on the device — handle the "not available" case.
- Changing `app.json` plugins requires a native rebuild, not a Metro reload.

## Milestones

1. **Core BLE + local tracking** — pairing screen, live workout (BPM, timer, rolling avg),
   session summary (duration, avg/max/min HR), history list→detail, local persistence.
   *Current milestone.*
2. **Platform integration + polish** — units toggle, i18n, Health Connect write-back,
   offline indicator, Firebase auth + prefs sync, responsive tablet layout.
3. **Stretch** — Strava import/export, GPS route + map, step counts from Health Connect,
   MET/HR calorie estimation, weight tracking, altitude profile.

This file is updated as the project progresses — treat milestone markers above as live.
