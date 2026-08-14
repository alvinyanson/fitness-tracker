@AGENTS.md

# Fitness Tracker

React Native / Expo SDK 56 app that pairs with a standard BLE Heart Rate device (GATT
service `0x180D`), records live workout sessions, and writes them back to Health Connect.

- `docs/specs.md` — requirements and per-milestone scope. Read before planning feature work.
- `docs/ui-reference/` — visual direction. Read before writing a screen or component.

This file holds the decisions the spec leaves open, and overrides the spec where the two
conflict.

## Non-negotiables

- **Android only.** Where the spec gives an iOS path alongside an Android one, take the
  Android one and ignore the rest. No iOS code, no iOS-only packages, no `ios` blocks in
  `app.json`, no HealthKit / Apple Sign-In / SF Symbols / CoreMotion. The existing `ios`
  config in `app.json` is inherited scaffolding — leave it, don't extend it.
- **No custom backend** (spec constraint). On-device, Health Connect, or configured
  Firebase. Never propose a server, an API layer, or a sync protocol. Of the BaaS options
  the spec offers, Firebase is the choice.
- **Expo SDK 56 only.** Read `https://docs.expo.dev/versions/v56.0.0/` for the versioned
  API before writing code. Do not rely on memory of older SDKs.
- **Expo Go does not work here.** The native modules require a dev client via
  `expo run:android`. Never suggest a fix that assumes Expo Go.
- **New Architecture is on** (RN 0.85 / React 19). Reject old-arch-only packages.
- **Install with pnpm**, pinning Expo-managed packages via `npx expo install`.
- **Build for portability** — the spec's "Reusables" exercise is the point of the
  project. Generic logic in the middle, app-specific wiring at the edges. If something
  can't be written that way, say so and say why.

## Commands

```bash
pnpm start            # Metro (dev client, not Expo Go)
pnpm android          # expo run:android — required for native modules
pnpm test             # jest-expo
```

`pnpm ios` and `pnpm web` are leftover template scripts. Neither is a supported target.

## Layout

```
src/
  app/             # expo-router file-based routes (the route root)
  components/      # reusable UI components
  hooks/           # React hooks — adapts services to React
  interfaces/      # shared TypeScript types and interfaces
  services/        # plain TypeScript — no React imports, portable and unit-testable
  store/           # zustand stores
  theme/           # design tokens (colors, typography, layout)
  utils/           # pure utility functions
```

Path alias: `@/*` → `./src/*`. Modules under `src/` import each other via `@/…`.
Relative imports are allowed only between co-located siblings inside one directory.

Layering contract:

```
app/ ──▶ components/ ──▶ hooks/ ──▶ services/ ──▶ interfaces/
  │              │                        │
  └──────────────┴────────▶ theme/        └──▶ utils/
```

- `services/` imports no React and nothing from `app/`, `components/`, `hooks/`, `store/`,
  or `theme/`. It is plain TypeScript, unit-testable without a renderer. Native-module
  access inside a service adapter (e.g. `react-native-ble-plx`) is intentional — the rule
  is no _React_ imports, not no native imports.
- `components/` never imports from `services/`; it goes through `hooks/`.
- `interfaces/` and `theme/` import nothing from the app.
- `interfaces/` (not `types/`) is the home for shared TypeScript types.

Only directories with real files are created. `components/`, `hooks/`, `interfaces/`,
`services/`, `store/`, `utils/` are agreed future homes — they will be created by the
issues that first need them.

## UI & theming

- **`docs/ui-reference/design.md`** is the visual source of truth for design tokens (colors, typography, radii, spacing). Tokens live in `src/theme/` — import from `@/theme`, never from individual token files. Never hardcode a hex, font size, or radius in a component.
- **Mockup Images (`docs/ui-reference/*.png`)**: ALWAYS inspect the corresponding screenshot (e.g. `live_workout.png`, `device_pairing.png`, `session_summary.png`) using `view_file` before building or modifying any screen or component. Match the visual hierarchy, component layout, and overall look and feel of the mockup while adhering to the functional scope in `docs/specs/`.

**Fonts are pending.** The three custom fonts (Hanken Grotesk, Inter, JetBrains Mono) need `expo-font` and their font files loaded in a separate issue. Until then, fall back to the system face rather than substituting a different family into the tokens. The `fontFamily` values exist as string constants in `src/theme/typography.ts` but must not be applied to `Text` styles until the fonts are loaded.

## Testing

`jest-expo` is the runner — the officially supported preset for SDK 56, and it handles
the RN module/transform resolution that plain Jest does not. Pair with
`@testing-library/react-native` for component tests.

- Highest-value coverage is the pure logic in `services/`: HR characteristic parsing,
  session stat reduction (avg/max/min), later the MET/HR calorie math. These need no
  mocks — keep them free of React and native imports so they stay that way.
- Mock `react-native-ble-plx` at the module boundary; never test against real hardware.
- Maestro covers E2E in M2. It can't drive real BLE, so scope it to manual-entry and
  history flows.

## Tech stack

**Do not add a deferred package until its milestone starts.**

**Milestone 1** — `expo` 56 / `react-native` 0.85 / `react` 19 · `expo-router` (the
History → Summary list→detail flow earns file routing) · `react-native-ble-plx`
(installed; its Android 12+ runtime permission gate and adapter-state check landed in
`docs/specs/android-ble-permission-gate/SPEC.md` — scanning/connect logic is still a
separate, not-yet-filed issue) · `zustand` (session state machine

- settings) · `react-native-mmkv` · `expo-keep-awake` (the live screen must not sleep
  mid-session) · `react-native-reanimated`, `-gesture-handler`, `-screens`,
  `-safe-area-context` (expo-router deps, also the animated BPM readout) · `jest-expo`,
  `@testing-library/react-native` · `oxlint`, `prettier`, `husky`, `lint-staged`.

**Milestone 2** — `react-native-health-connect` (Google Fit is deprecated, never use it) ·
`expo-build-properties` (Health Connect needs an explicit `minSdkVersion` /
`compileSdkVersion`; check its current requirements when you add it) ·
`@react-native-firebase/app` + `auth` + `firestore` (Google login, syncing units and
language only) · `@react-native-google-signin/google-signin` (the one login provider in
scope) · `@react-native-community/netinfo` · `i18n-js` + `expo-localization` ·
`react-native-svg` for the HR chart (`recharts` in the spec is web-only — ignore it) ·
`@react-native-firebase/crashlytics` (optional) · Maestro.

**Milestone 3** — `expo-secure-store` + `expo-auth-session` (Strava OAuth),
`expo-location` + `expo-task-manager` (route sampling), `react-native-maps` or
`@rnmapbox/maps`, `expo-sqlite` (see below), TanStack Query (only if Strava's REST API
actually lands — nothing before M3 has server state worth caching).

### Storage

MMKV holds key-value data: last-paired device, units, language, user weight, session
index. `@react-native-async-storage/async-storage` is still a dependency and still backs
the last-paired-device store — migrate it to MMKV and drop the package; don't add new
call sites.

Session **time series** (per-second HR, GPS points, altitude) move to `expo-sqlite` when
M3 route tracking lands — JSON blobs in MMKV won't hold up at that volume. Keep the
storage layer as the seam so that swap stays local.

## Domain conventions

- **Connection state is an explicit union**, not booleans: `idle | scanning | connecting |
connected | disconnected | error`. Every new async flow follows this shape.
- **A disconnect never kills an active session.** Reconnecting indicator, timer keeps
  running. BLE drops are routine.
- **HR is optional per session.** Every stat, and the calorie formula, must work with zero
  HR samples — fall back to the pure MET formula.
- **Sessions save locally the moment the user hits Stop**, before any sync or health-store
  write is attempted.
- **Storage keys are namespaced** `@fitness_tracker/<name>`.
- **Health Connect is the source of truth for aggregate body data** — steps and body
  weight are read from and written to it rather than tracked separately.
- **Altitude comes from GPS** (M3), not the barometer: Android barometer availability is
  inconsistent across devices, and GPS altitude already arrives with the route coordinates.

## Cross-cutting requirements

Every change to a screen, component, hook, or util — new or modified — covers all
three by default, without being asked per-task:

- **Accessibility**: `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, and
  `accessibilityState` on interactive and meaningful elements, matching the pattern
  already applied across `src/app/` and `src/components/`.
- **i18n**: no hardcoded user-facing strings. Route them through `useTranslation`'s
  `t(...)`, and add the new key to every file in `src/services/i18n/translations/`
  (`en.json`, `ja.json`), not just one.
- **Crash logging**: any call that can throw or reject — BLE operations, storage reads/
  writes, and (once added) Health Connect and Firebase calls — is wrapped so failures
  report through `src/services/crashService.ts` rather than failing silently or only
  hitting `console.*`.

## Native config

`app.json` permissions must stay in sync with any new native module. `react-native-ble-plx`
is configured: its Expo config plugin is registered and `android.permissions` declares
`BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, and
`ACCESS_FINE_LOCATION`, added and permission-reviewed in
`docs/specs/android-ble-permission-gate/SPEC.md`. The pairing screen (`src/app/index.tsx`)
gates on these via `useBlePermissionGate` before rendering anything else — see
`src/services/ble/blePermissionGate.ts` for the permission/adapter-state precedence.
Health Connect (M2) adds its own permission set and config plugin, and requires the
Health Connect app present on the device — handle the "not available" case. Changing
`app.json` plugins requires a native rebuild, not a Metro reload.

## Milestones

Scope lives in `docs/specs.md`. **Milestone 1 — core BLE + local tracking — is the
current one.** Treat this marker as live; it moves as the project progresses.
