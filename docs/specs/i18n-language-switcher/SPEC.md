# Feature: i18n Module + Language Switcher

## Intent

Every user-facing string in `src/` is resolved through a typed `t()` lookup backed by
`i18n-js`, defaults to the device's locale via `expo-localization`, and can be overridden
by the user from Settings — the override persists across restarts and switching language
re-renders the whole app immediately, with no literal strings left in components.

## Context

- **Problem statement:** No translation module exists. `src/app/index.tsx`,
  `history.tsx`, `workout.tsx`, and `summary/[id].tsx` all hardcode English `Text`
  content directly in JSX (`"Pairing"`, `"Go to Workout"`, `"Go to History"`,
  `"History"`, `"View Demo Summary"`, `"Workout"`, `"Back to Pairing"`, `"Summary"`,
  `"Back to History"` — confirmed by reading all four screens). Neither `i18n-js` nor
  `expo-localization` is a dependency in `package.json`. There is no `src/store/`
  directory yet, so there is nowhere to persist a language override.
- **Current code:** `src/services/formatDuration.ts` renders `mm:ss` / `h:mm:ss` from a
  digit count — it is locale-invariant (no month names, no decimal separators) and is
  explicitly out of scope for this issue; nothing else in the app currently formats a
  date or a number. `src/theme/` and `src/services/storage/mmkvStorage.ts` are the only
  existing "generic, no-React" modules this feature can pattern-match against.
- **User impact:** A visible language switcher (in Settings) that changes every string
  on screen without an app restart, and remembers the choice next launch. Until a
  screen renders real dates or numbers (session timestamps, HR values), the new
  `formatDate`/`formatNumber` utilities have no live caller — they exist so History and
  Summary don't hardcode a locale when they start rendering real session data.
- **Dependencies — hard blocker:** Issue #19 explicitly depends on #18 ("settings store
  - metric/imperial units toggle") for the settings store and the Settings route. As of
    this spec, #18 has not landed: `src/store/` does not exist and there is no
    `src/app/settings.tsx`. This spec assumes #18's `src/store/settingsStore.ts` (zustand
  - MMKV persist) and `src/app/settings.tsx` exist by the time this issue is
    implemented, and this issue only _adds_ a `language` field/setter and a language
    switcher control to what #18 built. **Do not build a parallel store or a parallel
    settings screen to route around the missing dependency** — block on #18 landing
    first. If #18's actual shape differs from what's assumed below (field names, persist
    adapter), adapt this spec's Data Model to match the real store rather than the
    reverse.
- **Weather-app port note:** The issue and `docs/specs.md:52` frame this as "mostly a
  port" of a translation module already built for a prior "weather app." That project's
  source is not present in this repository or workspace, so nothing from it can be read
  or verified — this spec designs the module fresh against `i18n-js` v4 +
  `expo-localization`'s current API and this repo's conventions rather than assuming
  parity with unseen code. Record in the PR what would have been a straight port versus
  what had to be rebuilt, per the issue's reuse-exercise note.

## Data Model

- `src/interfaces/i18n.ts` (new):
  ```ts
  export type LocaleCode = 'en' | 'es';

  export const SUPPORTED_LOCALES: readonly LocaleCode[] = ['en', 'es'];

  export const DEFAULT_LOCALE: LocaleCode = 'en';

  // Recursive string-leaf shape every locale file must satisfy.
  export type TranslationTree = { [key: string]: string | TranslationTree };
  ```
- Locale files are flat-nested JSON under `src/services/i18n/translations/`, one file
  per `LocaleCode` (`en.json`, `es.json`), grouped by screen/domain:
  ```json
  {
    "pairing": {
      "title": "Pairing",
      "goToWorkout": "Go to Workout",
      "goToHistory": "Go to History"
    },
    "history": { "title": "History", "viewDemoSummary": "View Demo Summary" },
    "workout": { "title": "Workout", "backToPairing": "Back to Pairing" },
    "summary": { "title": "Summary", "backToHistory": "Back to History" },
    "settings": {
      "languageLabel": "Language",
      "languageEnglish": "English",
      "languageSpanish": "Español"
    }
  }
  ```
  `en.json` is the reference/default file — every other locale file must contain every
  key path `en.json` has (extra keys in a non-default locale are not an error; a
  missing one is).
- **Settings store (assumed, owned by #18; this issue extends it):**
  ```ts
  // src/store/settingsStore.ts
  interface SettingsState {
    units: 'metric' | 'imperial'; // from #18, untouched by this issue
    language: LocaleCode; // added by this issue
    setUnits: (units: 'metric' | 'imperial') => void; // from #18
    setLanguage: (language: LocaleCode) => void; // added by this issue
  }
  ```
  `language` is seeded once, on store creation, from
  `Localization.getLocales()[0]?.languageCode` intersected with `SUPPORTED_LOCALES`;
  anything unsupported (or no locales reported) falls back to `DEFAULT_LOCALE`. The
  seeded value persists through #18's existing MMKV-backed `persist` middleware — no
  second persistence mechanism.
- Invariant: `i18n.locale` (the `i18n-js` instance's active locale) is always kept equal
  to `settingsStore`'s `language` field — the store is the single source of truth, the
  `I18n` instance is a derived, synced view of it. Nothing sets `i18n.locale` directly
  outside `useTranslation`.

## Interfaces / API

`src/services/i18n/i18n.ts` — no React import, mirrors `mmkvStorage.ts`'s
"generic engine, no app awareness beyond wiring translations in" shape:

```ts
export const i18n: I18n; // configured instance: translations = { en, es }, defaultLocale = 'en', enableFallback = true
export function setLocale(locale: LocaleCode): void; // i18n.locale = locale
export function getDeviceLocale(): LocaleCode; // Localization.getLocales()[0]?.languageCode, guarded against SUPPORTED_LOCALES, else DEFAULT_LOCALE
```

`src/hooks/useTranslation.ts` — the one call site components use, adapting the service
to React per `CLAUDE.md`'s `hooks/` layer:

```ts
export function useTranslation(): {
  t: (key: string, options?: Record<string, unknown>) => string;
  language: LocaleCode;
  setLanguage: (language: LocaleCode) => void;
};
```

- Selects `language`/`setLanguage` from `useSettingsStore`. On every render, calls
  `setLocale(language)` before returning `t` so translation is always resolved against
  the current store value — cheap (a property assignment), and avoids a `useEffect`
  race between store update and next render.
- `t` is `i18n.t.bind(i18n)`. Because the hook subscribes to `useSettingsStore`'s
  `language` via zustand's selector, every component that calls `useTranslation()`
  re-renders when `language` changes — this is what makes "switch language → whole app
  re-renders, no restart" true, with no top-level context provider required.
- Missing key behavior: `i18n-js` returns `"[missing "en.foo.bar" translation]"`-style
  placeholders by default when a key is absent from every locale (not just the active
  one) — left as `i18n-js` default rather than silently swallowed, so a missing key is
  visible in dev instead of rendering blank.

`src/utils/formatDate.ts` / `src/utils/formatNumber.ts` — pure, no React, no store
import per the `utils/` layering rule (locale is an explicit parameter, not read from
the store internally):

```ts
export function formatDate(
  date: Date,
  locale: LocaleCode,
  options?: Intl.DateTimeFormatOptions,
): string;
export function formatNumber(
  value: number,
  locale: LocaleCode,
  options?: Intl.NumberFormatOptions,
): string;
```

- Thin wrappers over `Intl.DateTimeFormat(locale, options).format(date)` and
  `Intl.NumberFormat(locale, options).format(value)` — Hermes (RN's JS engine) ships
  `Intl` support, so no additional polyfill dependency is needed.
- Callers (future History/Summary work) get `locale` from `useSettingsStore` and pass it
  in explicitly; these utilities never read the store themselves, keeping them
  synchronously testable with zero mocks.

## Files Created

| File                                             | Purpose                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/interfaces/i18n.ts`                         | `LocaleCode`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `TranslationTree` shared types.             |
| `src/services/i18n/translations/en.json`         | Reference/default locale; source of truth for the key-coverage test.                             |
| `src/services/i18n/translations/es.json`         | Second supported locale.                                                                         |
| `src/services/i18n/i18n.ts`                      | Configured `I18n` instance, `setLocale`, `getDeviceLocale`.                                      |
| `src/hooks/useTranslation.ts`                    | React adapter: syncs `i18n.locale` to the settings store, returns `t`/`language`/`setLanguage`.  |
| `src/utils/formatDate.ts`                        | Locale-aware date formatting, pure function.                                                     |
| `src/utils/formatNumber.ts`                      | Locale-aware number formatting, pure function.                                                   |
| `src/tests/services/i18n/i18n.test.ts`           | Unit tests: translate, interpolation, fallback, `getDeviceLocale` against a mocked Localization. |
| `src/tests/services/i18n/localeCoverage.test.ts` | Walks `en.json`'s key paths and asserts every other locale file has the same paths.              |
| `src/tests/hooks/useTranslation.test.tsx`        | Renders a probe component, asserts re-render on `setLanguage`, asserts persisted default seed.   |
| `src/tests/utils/formatDate.test.ts`             | Locale-formatted date output across `en`/`es`.                                                   |
| `src/tests/utils/formatNumber.test.ts`           | Locale-formatted number/decimal-separator output across `en`/`es`.                               |

## Files Modified

| File                         | Change                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`               | Add `expo-localization` (`npx expo install`) and `i18n-js` (`pnpm add`, not Expo-managed).                                                          |
| `src/store/settingsStore.ts` | Add `language: LocaleCode` + `setLanguage`, seeded via `getDeviceLocale()`. **Assumes this file exists from #18** — see Dependencies.               |
| `src/app/settings.tsx`       | Add a language switcher control (one row per `SUPPORTED_LOCALES` entry) calling `useTranslation().setLanguage`. **Assumes #18 created this route.** |
| `src/app/index.tsx`          | Replace `"Pairing"`, `"Go to Workout"`, `"Go to History"` with `t('pairing.title')` etc. via `useTranslation()`.                                    |
| `src/app/history.tsx`        | Replace `"History"`, `"View Demo Summary"` with translated keys.                                                                                    |
| `src/app/workout.tsx`        | Replace `"Workout"`, `"Back to Pairing"` with translated keys.                                                                                      |
| `src/app/summary/[id].tsx`   | Replace `"Summary"`, `"Back to History"` with translated keys.                                                                                      |

## Implementation Steps

1. Confirm #18 has landed (`src/store/settingsStore.ts` and `src/app/settings.tsx`
   exist). If not, stop and land #18 first — do not build a substitute.
2. `npx expo install expo-localization`; `pnpm add i18n-js`. Confirm both land in
   `package.json` `dependencies`.
3. Add `src/interfaces/i18n.ts` (`LocaleCode`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`,
   `TranslationTree`).
4. Add `src/services/i18n/translations/en.json` covering every string currently
   hardcoded in `src/app/*.tsx` (enumerated in Files Modified), plus the settings
   language-switcher labels. Add `es.json` as a full, human-reviewed translation of the
   same key set (not machine-filler text — this is the second language the key-coverage
   test and manual QA both exercise).
5. Implement `src/services/i18n/i18n.ts`: construct the `I18n` instance from both locale
   files, `defaultLocale = DEFAULT_LOCALE`, `enableFallback = true`; implement
   `getDeviceLocale()` against `expo-localization`'s `getLocales()`.
6. Write `src/tests/services/i18n/i18n.test.ts` and
   `src/tests/services/i18n/localeCoverage.test.ts` against real (non-mocked)
   `en.json`/`es.json` content, and a mocked `expo-localization` for the device-locale
   cases.
7. Extend `src/store/settingsStore.ts` with `language`/`setLanguage`, seeded from
   `getDeviceLocale()` at store creation, persisted through the existing MMKV `persist`
   config from #18 (add `language` to its persisted-keys allowlist if #18 defines one
   explicitly).
8. Implement `src/hooks/useTranslation.ts` on top of the store and `setLocale`. Write
   `src/tests/hooks/useTranslation.test.tsx`: a probe component that renders `t(...)`,
   asserts it updates after calling the hook's `setLanguage`, and asserts a fresh store
   (mocked device locale = `es`) seeds `language: 'es'`.
9. Implement `src/utils/formatDate.ts` / `formatNumber.ts` and their unit tests (no
   store/React involved — pure `Intl` wrapper tests).
10. Replace every hardcoded string in `src/app/index.tsx`, `history.tsx`, `workout.tsx`,
    `summary/[id].tsx` with `useTranslation().t(...)` calls; add the language switcher
    row to `src/app/settings.tsx`.
11. `grep` sweep for stray literal `Text` content under `src/app/` and `src/components/`
    (once components exist) to confirm nothing was missed; fold any hit into a locale
    key.
12. Run verification commands (below).

## Style & Conventions

- `services/i18n/` has no React import and nothing from `app/`, `components/`, `hooks/`,
  `store/`, or `theme/`, per `CLAUDE.md`'s layering contract — `useTranslation.ts` is the
  hook-layer adapter that bridges it to the store, matching how `hooks/` is described as
  the seam between `services/` and the rest of the app.
- `LocaleCode`/`TranslationTree` live in `src/interfaces/`, not a local `types/` file,
  per `CLAUDE.md`.
- `formatDate`/`formatNumber` live in `src/utils/` (pure, no React/store import) rather
  than `src/services/`, since `CLAUDE.md` splits "plain TypeScript with native-module
  access allowed" (`services/`) from "pure utility functions" (`utils/`) — these touch
  only `Intl`, a JS-engine global, not a native module.
- Test files mirror source paths 1:1 under `src/tests/`, matching the existing
  `src/tests/services/formatDuration.test.ts` convention.
- No new abstraction beyond what's listed: no i18n React Context/Provider is introduced
  because zustand's own subscription model already delivers "the whole app re-renders on
  language change" — adding a Context on top would duplicate that mechanism.
- Locale files are hand-authored JSON, not a code-generation step or a translation-vendor
  integration — out of scope for an on-device-only, no-custom-backend app per
  `CLAUDE.md`'s non-negotiables.

## Acceptance Criteria

- [ ] Every string in `src/app/index.tsx`, `history.tsx`, `workout.tsx`, and
      `summary/[id].tsx` resolves through `t()`; no literal user-facing string remains
      in JSX (verified by the manual `grep` sweep in step 11 plus visual inspection).
- [ ] Calling `setLanguage('es')` from any component updates the currently-rendered
      screen's text without a remount/restart (asserted in
      `useTranslation.test.tsx`).
- [ ] The chosen language persists: a fresh `settingsStore` read after a simulated
      restart (re-hydrating from the same mocked MMKV backing) returns the previously
      set `language`, not the device default.
- [ ] `getDeviceLocale()` returns `DEFAULT_LOCALE` when the reported device locale isn't
      in `SUPPORTED_LOCALES`, and the matching supported code otherwise.
- [ ] `localeCoverage.test.ts` fails if `es.json` is missing any key path present in
      `en.json`, and passes against the checked-in files.
- [ ] `formatDate`/`formatNumber` produce locale-appropriate output for both `en` and
      `es` (e.g. decimal-separator/date-order differences covered in their tests).
- [ ] `pnpm test` passes, including all new suites.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- Android only, per `CLAUDE.md` — no iOS locale/region special-casing.
- Exactly two locales ship in this issue (`en`, `es`); adding a third later means adding
  one JSON file plus a `SUPPORTED_LOCALES` entry, not touching `i18n.ts`'s shape.
- Hard-blocked on #18: this issue does not create a settings store or a Settings route
  from scratch. If #18's actual field names differ from the `units`/`language` shape
  assumed here, this spec's Data Model section is wrong and must be reconciled with the
  real store before implementation proceeds.
- `formatDate`/`formatNumber` ship with unit tests but no live caller yet — no screen
  currently renders a real date or number (History/Summary are still stubs per
  Milestone 1). Wiring them into a screen is that screen's own future issue, not this
  one.
- `formatDuration.ts` is unchanged — its `mm:ss`/`h:mm:ss` output is digit-based, not
  locale-sensitive, and is explicitly not part of this issue's scope.
- No translation-vendor pipeline, no over-the-air locale updates, no pluralization rules
  beyond what `i18n-js`'s built-in `count` interpolation already provides out of the box.
- The prior "weather app" translation module referenced by the issue and
  `docs/specs.md:52` is not available to read in this repository or workspace; this spec
  is not a verified port of it, and the PR description should say what was assumed
  versus rebuilt from scratch.
