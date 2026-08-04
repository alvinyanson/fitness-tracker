# Feature: expo-router + `src/` layering scaffold

> Source: [GitHub issue #1](https://github.com/alvinyanson/fitness-tracker/issues/1) — `chore: scaffold expo-router + src/ layering, TS strict, path aliases` · Milestone **M1 — Core BLE + local tracking**

## Intent

A stock Expo template becomes the project's real foundation: file-based routing over a
settled `src/` tree, `@/*` path aliases, design tokens in `src/theme/`, a `strict`
type-check that passes, and `pnpm android` producing a dev-client build that boots to the
pairing route — so every M1 screen issue afterward is "add a route file", not "restructure
the app".

## Context

- **Problem statement:** `docs/specs.md` M1 needs four screens and a list → detail flow
  (History → Summary, `docs/specs.md:36-40`). The app today is the unmodified Expo blank
  template: `index.ts` calls `registerRootComponent(App)`, and `App.tsx:4-11` renders
  _"Open up App.tsx to start working on your app!"_. There is no navigator, no route tree,
  and `src/` exists but is empty.
- **Current code (verified this session, not assumed):**
  - `index.ts` — `registerRootComponent(App)`.
  - `App.tsx` — stock template screen, hardcoded `#fff`.
  - `src/` — **empty**. No components, hooks, services, or types.
  - `package.json` — dependencies are exactly `expo ~56.0.18`, `expo-status-bar ~56.0.4`,
    `react 19.2.3`, `react-native 0.85.3`; devDeps `@types/react`, `typescript ~6.0.3`.
    `"main": "index.ts"`. `"android": "expo start --android"`.
  - `app.json` — no `scheme`, no `plugins`, no `android.package`, no `android.permissions`.
  - `tsconfig.json` — `extends: expo/tsconfig.base` + `"strict": true`. No `baseUrl`, no
    `paths`, no `include`.
  - No `babel.config.js`, no `metro.config.js`, no test config, no lint config.
  - `android/` is generated and untracked (`.gitignore:39-41`) — config changes reach the
    native project through prebuild, never by hand-editing it.
- **Two stale claims in project docs, flagged for correction here.** `CLAUDE.md` states
  `react-native-ble-plx` is "already wired" and that `app.json` currently carries
  `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `ACCESS_FINE_LOCATION` and the ble-plx plugin.
  Neither is true of the current tree. Re-introducing BLE is **not** this issue — it needs
  its own — but `CLAUDE.md` should stop asserting it. See Files Modified.
- **Issue text vs. reality.** Issue #1's last scope bullet ("Move the existing
  `src/components/DevicePairingScreen.tsx` behind the `index` route with no behaviour
  change") and its BLE-flavored acceptance wording describe a tree that no longer exists.
  Per the user's direction, those lines are disregarded; `index` becomes a placeholder
  route that the pairing screen will later fill.
- **User impact:** No end-user-facing feature. The visible change is the template screen
  giving way to a dark, navigable four-route shell. Maintainers get routing, aliases,
  tokens, and a fixed module layout.
- **Dependencies:**
  - Runtime, all installed via `npx expo install` so SDK 56 pins apply: `expo-router`,
    `react-native-screens`, `react-native-safe-area-context`,
    `react-native-gesture-handler`, `react-native-reanimated`, `expo-linking`,
    `expo-constants`, `expo-dev-client`.
  - `expo-linking` and `expo-constants` are required by the SDK 56 installation guide but
    are missing from the issue's checklist. `expo-dev-client` is added because `CLAUDE.md`
    § Non-negotiables rules out Expo Go and the acceptance criterion is a _dev client_ boot.
  - `expo-status-bar` (already present) stays.
  - Blocks: every other M1 screen issue, plus the BLE re-introduction issue.
  - Config verified against https://docs.expo.dev/versions/v56.0.0/sdk/router/ ,
    https://docs.expo.dev/router/installation/ , https://docs.expo.dev/guides/typescript/
    and https://docs.expo.dev/versions/v56.0.0/sdk/reanimated/ (SDK 56, released
    2026-05-12).

### Scope decision: the theme port

`CLAUDE.md` § UI & theming makes it non-negotiable that no component hardcodes a hex, font
size, or radius, and names `docs/ui-reference/design.md` frontmatter as the authoritative
token source. The very first file this issue writes — the root layout — has to set a
background color or the app boots with a white flash against a dark design. So the token
port is pulled in here rather than deferred.

It is deliberately narrow: a mechanical transcription of the frontmatter into typed
constants. **No font loading** (`expo-font` and the Hanken Grotesk / Inter / JetBrains Mono
files are a separate issue; `CLAUDE.md` says fall back to the system face until then), no
component library, no theme context, no light mode. If you would rather this be its own
issue, step 7 below is the only step to cut — everything else stands on its own.

## Data Model

No domain model, no persistence, no migrations. This change defines no session, device, or
user type — those arrive with the features that need them.

Two typed shapes are introduced, both presentational:

- **Theme tokens** (`src/theme/`) — `Colors`, `TypeStyle`, `Radii`, `Spacing`, transcribed
  from `docs/ui-reference/design.md` frontmatter. Values are declared `as const` so token
  keys are literal-typed and a typo is a compile error rather than a runtime `undefined`.
  Units are converted to React Native's unitless numbers at transcription time: `48px` → `48`,
  `0.5rem` → `8`, `-0.02em` at 48px → `-0.96`. `fontFamily` values keep the design names as
  string constants but are **not** applied until the fonts load — see Constraints.
- **Route params** — `/summary/[id]` carries one string param `id`, read as
  `useLocalSearchParams<{ id: string }>()`. What `id` refers to (a session record) is
  defined by the session-storage issue, not here.

## Interfaces / API

### Route tree (`src/app/`)

| Route file         | URL            | Contract                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_layout.tsx`      | —              | Default export: root layout. Renders `<GestureHandlerRootView style={{ flex: 1 }}>` wrapping `<Stack>`, with `screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}`. Also renders `<StatusBar style="light" />` from `expo-status-bar`. Screens own their own chrome, matching the full-bleed dark mockups in `docs/ui-reference/`. |
| `index.tsx`        | `/`            | Placeholder pairing route. Title text plus `<Link>`s to `/workout` and `/history` so the graph is navigable end to end.                                                                                                                                                                                                                                                  |
| `workout.tsx`      | `/workout`     | Placeholder. Title text plus a `<Link href="/">` back affordance.                                                                                                                                                                                                                                                                                                        |
| `history.tsx`      | `/history`     | Placeholder. Title text plus a `<Link href="/summary/demo">` so the list → detail edge is exercised.                                                                                                                                                                                                                                                                     |
| `summary/[id].tsx` | `/summary/:id` | Placeholder. Reads `const { id } = useLocalSearchParams<{ id: string }>()` and renders it, proving dynamic-segment params resolve.                                                                                                                                                                                                                                       |

Every placeholder is content-free by design — it exists to make the route graph real and
navigable, and to be replaced wholesale by its own issue. Each styles itself only from
`@/theme`; none contains a literal hex, font size, or radius.

### Theme surface (`src/theme/`)

```ts
// @/theme
export const colors: Readonly<Record<ColorToken, string>>; // 47 M3 role tokens from design.md
export const type: Readonly<Record<TypeToken, TypeStyle>>; // 8 named text styles
export const radii: Readonly<Record<RadiusToken, number>>; // sm|base|md|lg|xl|full
export const space: {
  unit: 4;
  containerPadding: 20;
  stackGap: 16;
  gridGutter: 12;
  safeAreaBottom: 34;
};
export type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  lineHeight: number;
  letterSpacing?: number;
};
```

Consumers import from the `@/theme` barrel, never from the individual token files — that
keeps the eventual light-mode or font-loading rework local.

### Path alias

`@/*` → `./src/*`, honored by TypeScript and by Metro (Expo CLI reads
`compilerOptions.paths` from `tsconfig.json` automatically; **no `metro.config.js` is
needed**). Canonical specifiers after this change: `@/theme`, `@/components/…`,
`@/hooks/…`, `@/services/…`, `@/interfaces/…`.

Rule: modules under `src/` import each other via `@/…`. Relative imports are allowed only
between co-located siblings inside one directory.

### Layering contract

```
app/ ──▶ components/ ──▶ hooks/ ──▶ services/ ──▶ interfaces/
  │              │                        │
  └──────────────┴────────▶ theme/        └──▶ utils/
```

- `services/` imports no React and nothing from `app/`, `components/`, `hooks/`, `store/`,
  or `theme/`. It is plain TypeScript, unit-testable without a renderer.
- `components/` never imports from `services/`; it goes through `hooks/`.
- `interfaces/` and `theme/` import nothing from the app.

### Entry point

`package.json` `"main"` goes from `"index.ts"` to `"expo-router/entry"`. `index.ts` and
`App.tsx` are deleted; app code no longer calls `registerRootComponent`.

## Files Created

| File                       | Purpose                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `babel.config.js`          | Explicit `babel-preset-expo`. Not strictly required (Expo CLI falls back to it), but that preset is what auto-injects the Reanimated worklets plugin, so the dependency is made visible. |
| `src/app/_layout.tsx`      | Root `Stack` + `GestureHandlerRootView` + status bar; sets the app-wide dark surface.                                                                                                    |
| `src/app/index.tsx`        | Placeholder pairing route — the app's entry screen.                                                                                                                                      |
| `src/app/workout.tsx`      | Placeholder live-workout route; the navigation target for the acceptance smoke test.                                                                                                     |
| `src/app/history.tsx`      | Placeholder history route; origin of the list → detail edge.                                                                                                                             |
| `src/app/summary/[id].tsx` | Placeholder summary detail route; proves dynamic params resolve.                                                                                                                         |
| `src/theme/colors.ts`      | The 47 Material-3 color roles from `design.md` frontmatter, `as const`.                                                                                                                  |
| `src/theme/typography.ts`  | The 8 named type styles, px strings converted to RN numbers, `em` letter-spacing resolved against each style's font size.                                                                |
| `src/theme/layout.ts`      | `radii` (rem → px) and `space` (4px baseline, container padding, stack gap, grid gutter, safe-area bottom).                                                                              |
| `src/theme/index.ts`       | Barrel re-exporting `colors`, `type`, `radii`, `space` and their token types. The only theme import path components may use.                                                             |

## Files Modified

| File            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`  | `"main": "expo-router/entry"`. Change `"android"` from `"expo start --android"` to `"expo run:android"` — the current script launches Expo Go, which `CLAUDE.md` forbids and which cannot satisfy this issue's acceptance criterion. Add the eight packages at `npx expo install`-resolved versions. Leave `ios` / `web` scripts as-is (`CLAUDE.md` calls them known-dead leftovers).                                                                                                                                    |
| `app.json`      | Add `"scheme": "fitnesstracker"`, `"plugins": ["expo-router"]`, `"experiments": { "typedRoutes": true }`, and restore `"android": { "package": "com.arcanys.yansonalvin.fitnesstracker" }` alongside the existing `adaptiveIcon` / `predictiveBackGestureEnabled` keys — without an explicit applicationId, prebuild invents `com.anonymous.*` and the installed app identity churns. Do **not** add anything to the `ios` block.                                                                                        |
| `tsconfig.json` | Add `"baseUrl": "."`, `"paths": { "@/*": ["src/*"] }`, and `"include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]`. `"strict": true` is already set — keep it, add nothing stricter.                                                                                                                                                                                                                                                                                                                |
| `CLAUDE.md`     | § Layout: drop the "(placeholder — still being shaped, confirm before relying on it)" hedge and record the settled tree, the `@/*` alias, and the layering contract above; note `interfaces/` (not `types/`) as the home for shared types. § Tech stack / § Native config: correct the stale claims that ble-plx is "already wired" and that `app.json` carries BLE permissions — neither holds after the reset. § UI & theming: point at `src/theme/` as the live token location and note that fonts are still pending. |
| `App.tsx`       | **Deleted** — superseded by `src/app/_layout.tsx` + `src/app/index.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `index.ts`      | **Deleted** — superseded by the `expo-router/entry` main field.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

`.gitignore` needs no change: `.expo/` and `expo-env.d.ts` are already ignored
(`.gitignore:7-10`), which covers the generated typed-routes output.

## Implementation Steps

1. **Install.** `npx expo install expo-router react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated expo-linking expo-constants expo-dev-client`, then `npx expo install --check` to confirm every pin matches SDK 56. Use `npx expo install`, never a bare `pnpm add`, per `CLAUDE.md`.
2. **Entry point.** Set `"main": "expo-router/entry"` and fix the `android` script in `package.json`. Delete `index.ts` and `App.tsx` in the same commit so no dangling `registerRootComponent` survives.
3. **Config.** Add `scheme`, the `expo-router` plugin, `experiments.typedRoutes`, and the restored `android.package` to `app.json`. Create `babel.config.js` exporting `{ presets: ['babel-preset-expo'] }`.
4. **Aliases.** Add `baseUrl`, `paths`, and `include` to `tsconfig.json`.
5. **Route tree.** Create `src/app/_layout.tsx`, `index.tsx`, `workout.tsx`, `history.tsx`, `summary/[id].tsx` per the Interfaces table.
6. **Confirm route-root resolution.** The SDK 56 installation guide documents `src/app/_layout.tsx` as a supported root, but the `expo-router` plugin's `root` option still defaults to `"app"`. Start the bundler and check the routes register. **If no routes are found, set `"root": "./src/app"` on the plugin entry** and record it in `CLAUDE.md`. This is the one item to verify empirically rather than assume.
7. **Theme port.** Transcribe `docs/ui-reference/design.md` frontmatter into `src/theme/{colors,typography,layout,index}.ts`, converting units as described in Data Model. Restyle the five route files to draw every color, size, and radius from `@/theme`. _(Cuttable — see the Scope decision note. If cut, the route files must still avoid literals, which in practice means leaving them unstyled.)_
8. **Directory decisions.** Create only directories that gain a real file here — `src/app/` and `src/theme/`. Record `components/`, `hooks/`, `interfaces/`, `services/`, `store/`, `utils/` as the agreed future homes in `CLAUDE.md` **without** creating them. Git cannot track an empty directory, and a `.gitkeep` or a stub module is a commitment made before there is anything to commit to. This is the deliberate reading of the issue's "settle the rest of the tree" checkbox: decide and write it down, not scaffold-and-abandon.
9. **Type-check.** `npx tsc --noEmit`. Run this before touching native — it catches every alias and token mistake without a 5-minute rebuild.
10. **Build native.** `npx expo prebuild --clean -p android`, then `pnpm android`. A config plugin, a `scheme`, and an `android.package` are native config; a Metro reload will not pick them up, and Expo Go is not a valid verification path (`CLAUDE.md` § Non-negotiables).
11. **Smoke test on a device or emulator.** Cold-boot lands on `/` with no white flash. `/` → `/workout` → back (both the in-app link and the Android hardware back button). `/` → `/history` → `/summary/demo` renders the literal `demo`. Confirm the deep link resolves: `adb shell am start -W -a android.intent.action.VIEW -d "fitnesstracker://workout"` opens the workout route.
12. **Automated tests.** None in this change — see Constraints. Test tooling (`jest-expo`, `@testing-library/react-native`) is a separate M1 issue and is not pulled forward.

## Style & Conventions

- `CLAUDE.md` § Non-negotiables: Android only, no iOS additions, Expo SDK 56 versioned docs
  only, `npx expo install` for Expo-managed packages, no Expo Go assumptions, New
  Architecture packages only (RN 0.85 / React 19 default it on — no `newArchEnabled` flag
  needed).
- `CLAUDE.md` § UI & theming: `docs/ui-reference/design.md` frontmatter is the token source
  of truth; tokens live in `src/theme/` and are consumed from there; no hardcoded hex, font
  size, or radius in a component. The `.png` mockups are reference only — this change reads
  no measurements from them and builds no control that merely appears in one.
- `CLAUDE.md` § Layout: `services/` stays plain TypeScript with no React imports; `hooks/`
  adapts services to React; `components/` never calls a service directly. This change makes
  that contract explicit and enforceable rather than aspirational.
- `AGENTS.md`: SDK 56 docs consulted before writing config — see the Context dependency list
  for the exact pages.
- **SDK 56 breaking change:** Expo Router no longer supports importing from external
  `@react-navigation/*` packages in application code. Use `expo-router`'s own exports
  (`Stack`, `Link`, `useRouter`, `useLocalSearchParams`). No `@react-navigation/*` entry
  should appear in `package.json`.
- **Deviation, flagged:** issue #1's acceptance criterion _"Nothing under `services/`
  imports React or a native module directly"_ is vacuously true here — `src/services/`
  does not exist yet. It will not stay vacuous. When BLE returns, a BLE service has to
  import `react-native-ble-plx`, and a permission helper has to import `PermissionsAndroid`;
  a service forbidden from touching its own native module has nowhere to live. The workable
  rule, and the one this spec writes into `CLAUDE.md`, is the narrower one already in
  `CLAUDE.md` § Layout: **no React imports**, and no imports from `app/`, `components/`,
  `hooks/`, `store/`, or `theme/`. Native-module access inside a service adapter is
  intentional. A port/adapter indirection that would make services literally native-free is
  a legitimate design option — raise it separately if wanted; it is not a scaffolding task.

## Acceptance Criteria

- [ ] `npx tsc --noEmit` exits 0 with `strict: true` and the `@/*` alias resolving.
- [ ] `pnpm android` runs `expo run:android` and produces a dev-client build (not an Expo Go
      session) that cold-boots to `/`, rendered by `src/app/index.tsx`.
- [ ] The first frame is the dark `surface` token, with no white flash from a default
      background.
- [ ] `/` → `/workout` → back works via both the in-app link and the Android hardware back
      button, with no crash and no blank frame.
- [ ] `/` → `/history` → `/summary/demo` renders the literal `demo`, confirming dynamic
      params resolve.
- [ ] `adb shell am start -W -a android.intent.action.VIEW -d "fitnesstracker://workout"`
      opens the workout route, confirming the `scheme` took effect.
- [ ] `App.tsx` and `index.ts` no longer exist, and nothing imports them.
- [ ] No literal hex, font size, or border radius appears in any file under `src/app/`
      (`grep -rnE "#[0-9a-fA-F]{3,8}|fontSize: *[0-9]|borderRadius: *[0-9]" src/app` returns
      nothing). _(Waived if step 7 is cut.)_
- [ ] Every token key in `docs/ui-reference/design.md` frontmatter has a counterpart in
      `src/theme/`, with no invented values. _(Waived if step 7 is cut.)_
- [ ] No `@react-navigation/*` entry in `package.json` and no such import under `src/`.
- [ ] `app.json` gains no `ios` additions, and `android.package` reads
      `com.arcanys.yansonalvin.fitnesstracker`.
- [ ] `CLAUDE.md` no longer claims `react-native-ble-plx` is wired or that `app.json`
      carries BLE permissions, and its § Layout section records the settled tree.
- [ ] Automated tests: **N/A this change** — no test runner is installed, and installing one
      is a separate issue. Verification is the type-check plus the on-device smoke test
      above.

## Constraints

- **Scaffolding only.** All five route files are placeholders. No BLE, no live-workout
  logic, no session model, no history list, no summary stats — each is its own M1 issue.
- **BLE is absent and stays absent here.** `react-native-ble-plx`, its config plugin, and
  the `BLUETOOTH_*` / `ACCESS_FINE_LOCATION` permissions are all gone from the current tree.
  Re-introducing them needs its own issue with its own permission review; this change only
  corrects the docs that still claim they are present.
- **Fonts are not loaded.** Hanken Grotesk, Inter, and JetBrains Mono need `expo-font` and
  font files. Until that issue lands, `TypeStyle.fontFamily` values exist as tokens but must
  not be applied to a `Text` — per `CLAUDE.md`, fall back to the system face rather than
  substituting a different family into the tokens.
- **Dark mode only.** `design.md` frontmatter defines a single dark palette. No light-mode
  token set is invented, and `app.json`'s `userInterfaceStyle: "light"` is left alone rather
  than guessed at — flag it for the theming issue.
- **No state library, no storage.** `zustand`, `react-native-mmkv`, `expo-keep-awake`, and
  the AsyncStorage question all belong to their own M1 issues. Do not install them here.
- **No lint / test / format tooling.** `oxlint`, `prettier`, `husky`, `lint-staged`,
  `jest-expo` are M1 stack items scoped elsewhere, which is why acceptance stops at `tsc`
  plus a manual smoke test.
- **Android only.** The `ios` block in `app.json` is inherited scaffolding — leave it, do not
  extend it. `pnpm ios` and `pnpm web` remain unsupported.
- **Native rebuild required.** Adding a config plugin, a `scheme`, and an `android.package`
  invalidates the generated `android/` project. Anyone testing this branch must prebuild;
  fast refresh will not do.
- **Unresolved external fact:** whether `expo-router` auto-detects `src/app` in SDK 56 or
  needs the plugin's `root` option set to `./src/app`. Resolved by running the bundler
  (step 6); either way the fix is one line of config.
