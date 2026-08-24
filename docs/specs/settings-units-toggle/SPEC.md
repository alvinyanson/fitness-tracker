# Feature: Settings Units Toggle + Measurement Formatting Layer

## Intent

`settingsStore.units` stops being dead state: it is seeded from the device's measurement
system on first launch, exposed as a segmented `Metric | Imperial` control in the Units
section of Settings, and read by a single measurement-formatting layer that is the only
code in the app allowed to convert an SI value into a displayable one. Every stored and
computed magnitude stays SI — metres, kilograms, metres per second — and conversion happens
once, at render time, so toggling units re-renders every consumer immediately, survives a
restart through the existing MMKV persistence, and leaves Milestone 3's GPS distances
nothing to rework.

## Context

- **Problem statement:** GitHub issue #18 asks for "a persisted settings store (zustand +
  MMKV) with `units: metric | imperial` as its first key, defaulted from device locale", a
  settings route with the toggle, and "a formatting utility layer in `services/`/`utils/` —
  all distance/weight rendering goes through it". Half of that already landed sideways.
  `src/store/settingsStore.ts:20-40` already declares `units: 'metric' | 'imperial'` with
  `setUnits`, persisted under `@fitness_tracker/settings` — but hardcoded to `'metric'`
  (`settingsStore.ts:30`), never seeded from the device, and never read: `grep -rn imperial
src/` hits only `src/store/settingsStore.ts` and `src/tests/store/settingsStore.test.ts`.
  There is no unit-conversion code anywhere in `src/`, and no measurement formatter — the
  existing formatters (`src/utils/formatNumber.ts`, `formatDate.ts`, `formatRelativeDate.ts`,
  `src/services/formatDuration.ts`) are all unit-system-agnostic.
- **Current code:** `src/app/(tabs)/settings.tsx` exists and renders a Language section
  (`SUPPORTED_LOCALES.map` over inline `Pressable` option rows, `settings.tsx:38-77`) plus
  the two Health Connect cards. It is not a tab — `src/app/(tabs)/_layout.tsx` registers it
  with `href: null` and it is reached from `HeaderBar`'s profile press. `src/components/`
  has no `Switch`, `Toggle`, or `SegmentedControl`; the inline option row in `settings.tsx`
  is the only precedent for a selection control. `src/hooks/useTranslation.ts` is the
  established pattern for a hook that adapts a no-React service to a zustand-backed
  setting, and this feature's hook mirrors it exactly.
- **User impact:** a visible Units control in Settings that persists, defaults sensibly for
  a US/UK device instead of always starting metric, and a formatting seam that guarantees
  no screen ever hardcodes `km` or does its own `* 0.621371`.
- **Dependencies:** none unlanded. `zustand@^5.0.14`, `react-native-mmkv@^4.3.2`,
  `expo-localization@^56.0.6` and `i18n-js@^4.5.3` are all installed
  (`package.json:17,21,27,32`). `docs/specs/i18n-language-switcher/SPEC.md:29-39` recorded
  this issue as a hard blocker for #19; #19 shipped first and built the store and route
  itself, so that dependency is now inverted and satisfied — this issue extends what #19
  left behind rather than creating it.

### Nothing in the app renders a distance or a weight today

Confirmed by grep across `src/`: the only magnitudes on screen are BPM and calories
(`src/app/(tabs)/workout.tsx:180-182`, `t('workout.caloriesUnit') === 'kcal'`), and both are
identical in metric and imperial. The formatters specified below therefore ship with unit
tests and no production caller; their first consumer is Milestone 3 route tracking. This is
the same posture `docs/specs/i18n-language-switcher/SPEC.md:280-283` took for
`formatDate`/`formatNumber`, and it is deliberate — the issue's own note says "nothing in
Milestone 1 has a distance value yet; wire the toggle so Milestone 3's GPS distances need no
rework". The issue's acceptance line "toggling units updates every displayed value
immediately" is consequently verified through `useUnitFormat`'s test rather than on a screen.

### Milestone conflict, flagged not resolved

Issue #18 is filed under milestone "M2 — Platform integration, sync, polish" and
`docs/specs.md:50` lists the units toggle under Milestone 2, while `CLAUDE.md` marks
Milestone 1 as the current one. Health Connect work (also M2) has already landed, so the
milestone marker is trailing reality; this spec proceeds, and the discrepancy is noted for
whoever moves the marker.

## Data Model

`src/interfaces/units.ts` (new) — the shared vocabulary, in `interfaces/` not a local
`types.ts`, per `CLAUDE.md`:

```ts
export type UnitSystem = 'metric' | 'imperial';

export const SUPPORTED_UNIT_SYSTEMS = ['metric', 'imperial'] as const;

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

// A formatted magnitude, split so callers can style number and unit separately —
// StatCard already takes `value` and `unit` as distinct props.
export interface FormattedMeasurement {
  value: string;
  unit: string;
}

// Resolved unit labels, injected into the service so it never calls t() itself.
export interface UnitLabels {
  kilometers: string;
  miles: string;
  meters: string;
  feet: string;
  kilograms: string;
  pounds: string;
  kilometersPerHour: string;
  milesPerHour: string;
  perKilometer: string;
  perMile: string;
}
```

`src/store/settingsStore.ts` (modified) — the field already exists; only its type source and
its seed change:

```ts
export interface SettingsState {
  units: UnitSystem; // was the inline 'metric' | 'imperial' literal union
  language: LocaleCode;
  setUnits: (units: UnitSystem) => void;
  setLanguage: (language: LocaleCode) => void;
}

// units: getDeviceUnitSystem()   // was: units: 'metric'
```

The seed is evaluated once at store creation, exactly as `language: getDeviceLocale()`
already is (`settingsStore.ts:31`), and is then owned by the existing `persist` middleware —
no second persistence mechanism, no `partialize` change, no store version bump. A store
persisted before this change rehydrates with its stored `'metric'` and never sees the device
seed, which is correct: an explicit stored value must win over a device default.

**Canonical-SI invariant.** Distances are metres, weights kilograms, speeds metres per
second, everywhere in state, storage and computation. Imperial values exist only inside the
string returned by a formatter. Nothing converts on the way into the store.

`FormattedMeasurement.value` is produced by `formatNumber` and is therefore locale-formatted
(`1.234,5` under a comma-decimal locale) — a formatter's output is a function of both
`unitSystem` and `locale`.

## Interfaces / API

### `src/services/units/deviceUnitSystem.ts` (new — native read, no React)

```ts
export function getDeviceUnitSystem(): UnitSystem;
```

Reads `getLocales()[0]?.measurementSystem` from `expo-localization`. Per the SDK 56 API
reference (`https://docs.expo.dev/versions/v56.0.0/sdk/localization/`) that field is typed
`'metric' | 'us' | 'uk' | null`. Mapping: `'us'` and `'uk'` → `'imperial'`, `'metric'` →
`'metric'`, `null`/absent/empty `getLocales()` → `DEFAULT_UNIT_SYSTEM`. Mapping `'uk'` to
imperial is a deliberate simplification — the UK is genuinely mixed (miles for distance,
kilograms for body weight) and this app has one global toggle, so the distance-facing
convention wins. Lives in `services/` beside `i18n.ts`'s `getDeviceLocale()` because it
touches a native module, which `CLAUDE.md` permits in `services/` but not `utils/`.

### `src/utils/unitConversion.ts` (new — pure, dependency-free)

```ts
export function metersToKilometers(meters: number): number;
export function metersToMiles(meters: number): number;
export function metersToFeet(meters: number): number;
export function kilogramsToPounds(kilograms: number): number;
export function metersPerSecondToKmh(mps: number): number;
export function metersPerSecondToMph(mps: number): number;
export function metersPerSecondToSecondsPerKilometer(mps: number): number;
export function metersPerSecondToSecondsPerMile(mps: number): number;
```

Exact factors as named module constants (`METERS_PER_MILE = 1609.344`,
`METERS_PER_FOOT = 0.3048`, `POUNDS_PER_KILOGRAM = 2.20462262185`), not inline magic
numbers. No rounding, no locale, no store, no `Intl` — rounding is a presentation decision
and belongs to the formatter. The two pace helpers return seconds per unit distance and
propagate `Infinity` for a zero input; the formatter, not the converter, decides what a
non-finite pace renders as.

### `src/services/units/formatMeasurement.ts` (new — the formatting layer, no React)

```ts
export interface MeasurementFormatContext {
  unitSystem: UnitSystem;
  locale: LocaleCode;
  labels: UnitLabels;
}

export function formatDistance(
  meters: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement;
export function formatWeight(
  kilograms: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement;
export function formatElevation(
  meters: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement;
export function formatSpeed(
  mps: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement;
export function formatPace(
  mps: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement;
```

Per-measure presentation rules, all applied through `src/utils/formatNumber.ts`'s
`Intl.NumberFormat` options rather than a second numeric formatter:

| Formatter         | Metric unit | Imperial unit | Fraction digits                    |
| ----------------- | ----------- | ------------- | ---------------------------------- |
| `formatDistance`  | `km`        | `mi`          | 1 (min 1, max 1)                   |
| `formatElevation` | `m`         | `ft`          | 0                                  |
| `formatWeight`    | `kg`        | `lb`          | 1                                  |
| `formatSpeed`     | `km/h`      | `mph`         | 1                                  |
| `formatPace`      | `/km`       | `/mi`         | n/a — `mm:ss` via `formatDuration` |

`formatPace` reuses `src/services/formatDuration.ts` for its `value`, so a 5-minute-12-second
kilometre renders as `05:12` (zero-padded — `formatDuration` pads minutes) with unit `/km`.
Reusing it rather than writing a second `mm:ss` routine is why this module sits in
`services/` and not `utils/`: `CLAUDE.md`'s layering allows `services/ → utils/`, not the
reverse, and `formatDuration` already lives in `services/`.

Non-finite and negative inputs return `{ value: '—', unit: <the unit label> }` — an em dash,
matching the placeholder `src/app/(tabs)/workout.tsx:88-89` already uses for absent BPM.
This covers `formatPace(0)`, whose underlying conversion divides by zero.

Labels are injected, never looked up: the service holds no `i18n-js` import, so it is
testable with a plain object and stays portable per `CLAUDE.md`'s "generic logic in the
middle, app-specific wiring at the edges".

### `src/hooks/useUnitFormat.ts` (new — the React adapter)

```ts
export function useUnitFormat(): {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  formatDistance: (meters: number) => FormattedMeasurement;
  formatWeight: (kilograms: number) => FormattedMeasurement;
  formatElevation: (meters: number) => FormattedMeasurement;
  formatSpeed: (mps: number) => FormattedMeasurement;
  formatPace: (mps: number) => FormattedMeasurement;
};
```

Selects `units`/`setUnits` from `useSettingsStore`, takes `t` and `language` from
`useTranslation()`, builds the `UnitLabels` record from the `units.*` translation keys, and
returns the five formatters bound to `{ unitSystem, locale: language, labels }`, memoised on
`[unitSystem, language, t]`. Components call only this hook — they never import
`formatMeasurement` or `unitConversion` directly, and `components/` importing from
`services/` is forbidden by `CLAUDE.md`'s layering contract anyway, which is what makes "no
component performs its own unit conversion" structurally enforced rather than a convention.

Because the hook subscribes through zustand, `setUnitSystem` re-renders every consumer with
no Context provider — the identical mechanism `useTranslation` relies on for instant
language switching.

### `src/components/SegmentedControl.tsx` (new — generic)

```ts
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  accessibilityHint?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>(
  props: SegmentedControlProps<T>,
): JSX.Element;
```

A rounded track (`radii.full`, `colors.surfaceContainerHigh`) holding one `Pressable` per
option; the active segment gets `colors.primaryContainer` with `colors.onPrimaryContainer`
text, inactive segments are transparent with `colors.onSurfaceVariant`. Two or more options,
no assumption of exactly two. Each segment carries `accessibilityRole="button"`,
`accessibilityLabel={option.label}`, `accessibilityHint`, and
`accessibilityState={{ selected }}` — the same prop set the shipped
`src/tests/app/settings.test.tsx:24-37` queries, so restyling Language to this control keeps
`getByRole('button', { name: 'English' })` working.

### `src/components/SettingsRow.tsx` (new)

```ts
export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode; // the trailing control
}
```

The card row from `docs/ui-reference/settings.png`: `colors.surfaceContainerLow` card at
`radii.md`, leading `Ionicons`, `type.bodyMd` label, trailing control slot. Non-interactive
itself — it renders no `Pressable` and takes no `onPress`, so the row contributes no
accessibility node of its own and the control inside owns all interaction.

## Files Created

| File                                                 | Purpose                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/specs/settings-units-toggle/SPEC.md`           | This specification.                                                                                  |
| `src/interfaces/units.ts`                            | `UnitSystem`, `SUPPORTED_UNIT_SYSTEMS`, `DEFAULT_UNIT_SYSTEM`, `FormattedMeasurement`, `UnitLabels`. |
| `src/services/units/deviceUnitSystem.ts`             | `getDeviceUnitSystem()` — maps `expo-localization`'s `measurementSystem` to a `UnitSystem`.          |
| `src/utils/unitConversion.ts`                        | Pure SI→imperial numeric conversions with named factor constants.                                    |
| `src/services/units/formatMeasurement.ts`            | The formatting layer: convert, round, locale-format, attach the injected unit label.                 |
| `src/hooks/useUnitFormat.ts`                         | React adapter binding the store's `units`, the active locale, and the translated labels.             |
| `src/components/SegmentedControl.tsx`                | Generic segmented pill control (the mockup's Metric/Imperial widget).                                |
| `src/components/SettingsRow.tsx`                     | Settings card row: icon + label + trailing control slot.                                             |
| `src/tests/utils/unitConversion.test.ts`             | Known-value assertions per conversion, including zero and negative input.                            |
| `src/tests/services/units/deviceUnitSystem.test.ts`  | `'metric' \| 'us' \| 'uk' \| null`, missing field, and empty `getLocales()`.                         |
| `src/tests/services/units/formatMeasurement.test.ts` | All five formatters × both unit systems × `en`/`ja`, plus `0`/negative/non-finite.                   |
| `src/tests/hooks/useUnitFormat.test.tsx`             | Probe component re-renders converted output after `setUnitSystem`; persists across rehydration.      |
| `src/tests/components/SegmentedControl.test.tsx`     | Accessibility props per segment, `onChange` payload, 3-option case.                                  |
| `src/tests/components/SettingsRow.test.tsx`          | Renders label, icon and child control; contributes no interactive node.                              |

## Files Modified

| File                                     | Change                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/settingsStore.ts`             | Import `UnitSystem` from `@/interfaces/units` in place of the inline literal union; seed `units: getDeviceUnitSystem()` instead of the hardcoded `'metric'`.                                                              |
| `src/app/(tabs)/settings.tsx`            | Add a `UNITS` section (`SettingsRow` + `SegmentedControl` bound to `useUnitFormat`); restyle the Language section to the same `SettingsRow` + `SegmentedControl` shape; delete the now-unused inline `optionRow*` styles. |
| `src/services/i18n/translations/en.json` | Add `settings.units*` keys and a top-level `units` namespace of unit labels.                                                                                                                                              |
| `src/services/i18n/translations/ja.json` | Same keys — `localeCoverage.test.ts` fails if either file is missing one.                                                                                                                                                 |
| `src/tests/store/settingsStore.test.ts`  | Add cases asserting a fresh store seeds `units` from a mocked `measurementSystem`, and that a persisted value wins over the device seed.                                                                                  |
| `src/tests/app/settings.test.tsx`        | Add cases for the Units segments' accessibility props, that pressing `Imperial` sets `units`, and that Language still resolves by role after the restyle.                                                                 |

New translation keys:

```json
{
  "settings": {
    "unitsLabel": "Units",
    "unitsMeasurementSystem": "Measurement System",
    "unitsMetric": "Metric",
    "unitsImperial": "Imperial",
    "unitsOptionHint": "Selects this measurement system"
  },
  "units": {
    "kilometers": "km",
    "miles": "mi",
    "meters": "m",
    "feet": "ft",
    "kilograms": "kg",
    "pounds": "lb",
    "kilometersPerHour": "km/h",
    "milesPerHour": "mph",
    "perKilometer": "/km",
    "perMile": "/mi"
  }
}
```

The `units.*` symbols are identical in `ja.json` — SI and imperial symbols are not
translated in Japanese usage — but must still be present in both files. `settings.units*`
are translated normally (`単位`, `メートル法`, `ヤード・ポンド法`, …). `settings.unitsLabel`
is the uppercase section header, matching how `settings.languageLabel` is used at
`settings.tsx:36`.

## Implementation Steps

1. Add `src/interfaces/units.ts` with `UnitSystem`, `SUPPORTED_UNIT_SYSTEMS`,
   `DEFAULT_UNIT_SYSTEM`, `FormattedMeasurement`, `UnitLabels`.
2. Add `src/utils/unitConversion.ts` with the eight pure conversions and their named factor
   constants; write `src/tests/utils/unitConversion.test.ts` against known values
   (1609.344 m → 1 mi, 1 kg → 2.20462… lb, 1 m/s → 3.6 km/h, 0 m/s → `Infinity` s/km).
3. Add `src/services/units/deviceUnitSystem.ts`; write
   `src/tests/services/units/deviceUnitSystem.test.ts`, mocking `expo-localization` with the
   `jest.mock('expo-localization', () => ({ getLocales: jest.fn() }))` idiom already used by
   `src/tests/services/i18n/i18n.test.ts:4-6`.
4. Add the `units.*` and `settings.units*` keys to **both** `en.json` and `ja.json`; confirm
   `pnpm test src/tests/services/i18n/localeCoverage.test.ts` still passes.
5. Add `src/services/units/formatMeasurement.ts` implementing the five formatters against
   the precision table above, reusing `formatNumber` and `formatDuration`; write
   `src/tests/services/units/formatMeasurement.test.ts` with a literal `UnitLabels` fixture —
   no `i18n-js` import, no mocks.
6. Add `src/components/SegmentedControl.tsx` and `src/components/SettingsRow.tsx` with theme
   tokens only, plus their two component tests.
7. Add `src/hooks/useUnitFormat.ts`; write `src/tests/hooks/useUnitFormat.test.tsx` — a probe
   component rendering `formatDistance(5000)`, asserting `5.0 km` then `3.1 mi` after
   `setUnitSystem('imperial')` with no remount, and asserting the value survives a
   rehydration cycle.
8. Change `src/store/settingsStore.ts` to seed from `getDeviceUnitSystem()` and take
   `UnitSystem` from `@/interfaces/units`; extend
   `src/tests/store/settingsStore.test.ts` with the seed and persisted-value-wins cases.
9. Rewrite the Language section of `src/app/(tabs)/settings.tsx` as `SettingsRow` +
   `SegmentedControl`, keeping the existing `accessibilityLabel`/`accessibilityHint` strings
   byte-identical so the shipped screen tests continue to pass; remove the dead
   `optionRow`/`optionRowActive`/`optionText`/`optionTextActive`/`optionsList` styles and the
   local `LANGUAGE_KEY_MAP` icon usage that no longer applies.
10. Add the `UNITS` section above `LANGUAGE` in `src/app/(tabs)/settings.tsx`, ordered as in
    `docs/ui-reference/settings.png`; extend `src/tests/app/settings.test.tsx`.
11. `grep -rn "0.621371\|1609\|2.2046\|'km'\|\"km\"" src/app src/components` to confirm no
    screen carries its own conversion or hardcoded unit string.
12. Verify:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Style & Conventions

- Layering per `CLAUDE.md`: `unitConversion.ts` is a pure leaf in `utils/`;
  `formatMeasurement.ts` and `deviceUnitSystem.ts` sit in `services/` with no React import
  (`formatMeasurement` needs `services/formatDuration`, and `services/ → utils/` is the
  permitted direction, not the reverse); `useUnitFormat.ts` is the only bridge to the store;
  `components/` and `app/` reach the layer exclusively through that hook.
- `UnitSystem` and friends live in `src/interfaces/`, not a co-located `types.ts`.
- Test files mirror source paths 1:1 under `src/tests/`, including the new
  `src/tests/services/units/` directory, matching the existing
  `src/tests/services/{ble,healthConnect,i18n,session,storage}/` layout.
- Styling is theme tokens only — `colors`, `radii`, `space`, `type` imported from `@/theme`,
  never a token file directly and never a literal hex, size, or radius. Segments respect the
  44×44pt minimum touch target from `docs/ui-reference/design.md`.
- Accessibility: every segment is a `button` with `accessibilityLabel`, `accessibilityHint`,
  and `accessibilityState={{ selected }}`, matching the pattern already asserted in
  `src/tests/app/settings.test.tsx`. `SettingsRow` adds no interactive node.
- i18n: no literal user-facing string in the new components or the Settings sections; unit
  symbols are translation keys too, so a future locale that writes them differently needs no
  code change. Every key lands in both `en.json` and `ja.json`.
- Crash logging: N/A — nothing in this feature can throw or reject. The conversions are
  arithmetic, `formatMeasurement` is total over its input domain by the `—` rule, and the
  one native read (`getLocales()`) is already relied on unguarded by
  `src/services/i18n/i18n.ts:27`; wrapping it here and not there would be inconsistent.
  Store writes go through the existing `mmkvStorage` adapter, which already reports through
  `crashService`.
- **Deliberate deviation, injected labels:** `formatMeasurement` takes a `UnitLabels` object
  rather than calling `t()` itself, unlike `formatRelativeDate.ts` which accepts an optional
  `t`. The stricter injection keeps the module free of any i18n dependency and testable with
  a literal fixture; the hook is the single place that resolves keys.
- **Deliberate deviation, no `Switch`:** the mockup's Dark Mode and Auto-reconnect rows use
  RN-style switches, but neither setting exists and neither is in this issue's scope, so no
  switch component is introduced. Only the Units and Language rows from
  `docs/ui-reference/settings.png` are built.

## Acceptance Criteria

- [ ] A fresh store on a device reporting `measurementSystem: 'us'` seeds
      `units: 'imperial'`; `'uk'` seeds `'imperial'`; `'metric'` and `null` seed `'metric'`
      (asserted in `deviceUnitSystem.test.ts` and `settingsStore.test.ts`).
- [ ] A store with a previously persisted `units` rehydrates to the stored value and ignores
      the device seed.
- [ ] The Settings screen renders a `UNITS` section with `Metric` and `Imperial` segments,
      each exposing `accessibilityRole="button"`, its label, the
      `settings.unitsOptionHint` hint, and `accessibilityState={{ selected }}`; pressing
      `Imperial` sets `useSettingsStore.getState().units === 'imperial'`.
- [ ] Toggling units re-renders a `useUnitFormat` consumer with converted output and without
      a remount: `formatDistance(5000)` yields `5.0 km` then `3.1 mi`.
- [ ] The chosen unit system survives a simulated restart — a rehydrated store returns the
      previously set value, not the device default.
- [ ] All five formatters produce the unit and precision in the Interfaces table for both
      systems, and locale-appropriate number formatting for both `en` and `ja`.
- [ ] `formatPace(0)`, negative input, and non-finite input each return `'—'` as the value,
      never `Infinity` or `NaN`.
- [ ] No file under `src/app/` or `src/components/` performs a unit conversion or contains a
      hardcoded unit string (step 11's grep sweep returns nothing).
- [ ] The Language section still resolves by role after the restyle —
      `getByRole('button', { name: 'English' })` and the `ja` switch case in
      `src/tests/app/settings.test.tsx` pass unchanged.
- [ ] `localeCoverage.test.ts` passes: every new key exists in both `en.json` and `ja.json`.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass.

## Constraints

- **Non-goals:** user body-weight entry or weight history — `docs/specs.md:89-91` puts that
  in the Milestone 3 stretch and ties it to Health Connect's native body-weight record
  rather than separate storage. The hardcoded `70` kg in
  `src/app/(tabs)/workout.tsx:98-108` is therefore left exactly as it is; `formatWeight`
  ships for that future issue.
- **Non-goals:** calories are not converted — `kcal` is the unit in both systems, and
  `src/app/(tabs)/workout.tsx:180-182` stays untouched.
- **Non-goals:** imperial→SI inverse conversions. No input field accepts an imperial value,
  so the reverse direction has no caller and is not written speculatively; it arrives with
  the weight-entry issue that needs it.
- **Non-goals:** Firestore settings sync (its own M2 issue), Dark Mode, Auto-reconnect
  toggle, profile/account rows, and the avatar block visible in
  `docs/ui-reference/settings.png` — none are in issue #18's scope.
- **No live caller:** `formatDistance`, `formatElevation`, `formatSpeed`, `formatPace` and
  `formatWeight` are covered by unit tests but rendered on no screen at merge time, because
  the app displays no distance, weight, speed or elevation yet. Wiring them in belongs to
  the screens that gain those values (M3 route tracking, M3 weight tracking).
- **Public API compatibility:** `SettingsState`'s shape is unchanged — `units` narrows from
  an inline literal union to the identical named `UnitSystem`, so existing callers and the
  `setState({ units: 'metric' })` idiom in the shipped tests keep compiling. No persisted
  key changes, no store version or migration is needed.
- **Android only**, per `CLAUDE.md` — no iOS region handling. Note `measurementSystem` is
  documented as `null` on web, which the `DEFAULT_UNIT_SYSTEM` fallback covers even though
  web is not a supported target.
- **Unverified externally:** whether an Android device with a mixed regional setup can report
  `measurementSystem: 'uk'` while the user expects kilograms is not asserted here — the
  single global toggle means an explicit user choice is always one tap away, and the seed is
  only a first-launch default.
- **Milestone marker:** issue #18 is M2 while `CLAUDE.md` still names M1 as current. Flagged
  above, not resolved by this spec.
