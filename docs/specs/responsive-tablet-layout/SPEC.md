# Feature: Responsive Tablet Layout

## Intent

Every screen is coherent and horizontally scroll-free from a 360dp phone up to a 10" tablet in
either orientation. History becomes a two-pane master/detail on wide screens and stays stacked
navigation on phones, the live workout screen spends extra width on layout rather than on an
oversized BPM readout, and rotating a tablet mid-session leaves the timer, the BLE connection,
and the navigation stack untouched.

## Context

- **Problem statement:** Issue #24 (M2). The app is portrait-locked and phone-only in its layout
  assumptions. `app.json` sets `"orientation": "portrait"`, which lands in the generated manifest
  as `android:screenOrientation="portrait"` (`android/app/src/main/AndroidManifest.xml:33`), so a
  tablet physically cannot rotate — the issue's first acceptance criterion is currently
  unreachable. `grep -rn "useWindowDimensions\|Dimensions\|breakpoint" src/` returns nothing:
  there is no width awareness anywhere in the codebase. Every screen is a single full-bleed
  column with `paddingHorizontal: space.containerPadding` (20px), so on a 1280dp-wide tablet a
  `StatCard` row stretches to ~1240dp and the 2×2 grid reads as four thin bands.
  `docs/ui-reference/design.md` describes a "Fluid Grid" and "mobile-first interaction" but
  defines no breakpoints, so there is no token to reach for.
- **Current code:**
  - `src/theme/layout.ts` — `radii` and `space` only. `space.containerPadding` (20),
    `space.stackGap` (16), `space.gridGutter` (12). No width or breakpoint token.
    `src/theme/index.ts` is the single public entry point (`@/theme`).
  - `src/theme/typography.ts` — fixed `fontSize`/`lineHeight` per token. `displayMetrics` (48) is
    the intended large-metric face per design.md, but the live BPM readout does not use it.
  - `src/app/(tabs)/(history)/history.tsx` — `HeaderBar` + `FlatList` of `HistoryListItem`, or a
    centered empty state. Reads `getSessionIndex()` directly, refreshes via `useFocusEffect`,
    deletes via an `Alert` on long-press, and navigates with `router.push('/summary/<id>')`.
  - `src/app/(tabs)/(history)/summary/[id].tsx` — `HeaderBar` + `ScrollView` containing hero
    badge, duration block, 2×2 `StatCard` grid, optional "no HR" notice,
    `HealthConnectSyncBadge`, a delete pill, and a "back to history" `Link`. Reads
    `getSession(id)` directly; `deleteSession` then `router.replace('/history')`. Its
    `scrollContent` already has `alignItems: 'center'`, so a max-width wrapper drops in without a
    visual change on phones.
  - `src/app/(tabs)/(history)/_layout.tsx` — a plain `Stack` with `headerShown: false`. The
    list→detail push is a real stack push, which is what has to become a pane swap on wide
    screens without changing the route table.
  - `src/app/(tabs)/workout.tsx` — `HeaderBar` + `ScrollView`: duration block, `BpmReadout` +
    `HrZoneBar`, 2×2 `StatCard` grid, a rolling-average line, and the Start / Pause+Stop /
    Resume+Stop control rows. `styles.statsGrid` is a fixed two-row × two-column structure
    (`statsRow` is `flexDirection: 'row'` with `gap: space.gridGutter`).
  - `src/components/BpmReadout.tsx` — hardcoded `fontSize: 64`, `lineHeight: 72`, and
    `<Ionicons size={36}>`. No size prop, so a tablet either keeps a phone-sized readout in a
    wide void or needs the magic numbers edited per screen — the thing the issue rules out.
  - `src/components/StatCard.tsx` — `flex: 1`, `minHeight: 88`. Already column-count agnostic:
    putting four in one `statsRow` needs no change to the card itself.
  - `src/components/HeaderBar.tsx` and `src/components/BottomNavBar.tsx` — both call
    `useSafeAreaInsets()` (each behind a `try`/`catch` fallback to zero insets) but consume only
    `insets.top` / `insets.bottom`. In landscape on a device with a cutout or gesture bar,
    `insets.left` / `insets.right` are non-zero and currently ignored.
  - `src/hooks/useWorkoutSession.ts` — owns the session state machine, the elapsed-time ticker,
    and `activateKeepAwakeAsync()` / `deactivateKeepAwake()`. Session truth lives in
    `src/store/workoutSessionStore.ts` (zustand), not in screen state, which is why rotation is
    survivable without new persistence work.
  - `src/services/storage/sessionHistoryStorage.ts` — `getSessionIndex`, `getSession`,
    `saveSession`, `deleteSession`. Synchronous MMKV reads.
  - `android/app/src/main/AndroidManifest.xml:33` — the generated `MainActivity` already declares
    `android:configChanges="…|orientation|screenSize|screenLayout|…|smallestScreenSize|…"`, so
    rotation does **not** recreate the activity and JS state survives it. `android/` is gitignored
    (`.gitignore:41`); `app.json` is the source of truth and prebuild regenerates the manifest.
  - `src/services/i18n/translations/en.json` / `ja.json` — flat namespaces (`history`, `workout`,
    `summary`, `common`, …). `src/tests/services/i18n/localeCoverage.test.ts` enforces key parity,
    so any new key must land in both files.
  - `src/tests/app/history.test.tsx`, `src/tests/app/workout.test.tsx`,
    `src/tests/app/summary/[id].test.tsx` — screen tests render the default export with a
    hand-rolled `jest.mock('expo-router', …)` and assert on translated text. They are the
    regression surface for both layouts.
- **User impact:** Tablet users can rotate freely; a workout in progress keeps its timer, HR
  stream, and keep-awake lock across the rotation. On a wide screen, history shows the session
  list beside the selected session's summary instead of pushing a new screen, and the live workout
  screen puts stats beside the heart-rate readout instead of below it. Phones behave exactly as
  they do today, with the addition that landscape is now permitted and legible.
- **Dependencies:** None new. `useWindowDimensions` ships with `react-native` 0.85 and
  `react-native-safe-area-context` (~5.7.0) is already installed and already used for insets.
  Changing `app.json`'s `orientation` is a native config change: it requires `pnpm android`
  (prebuild + rebuild) and produces a new EAS fingerprint, so it cannot ship as an OTA update.

### Facts to confirm during implementation

- **`useWindowDimensions` and rotation.** Confirm against
  `https://docs.expo.dev/versions/v56.0.0/` / RN 0.85 that the hook re-renders on Android
  rotation with the given `configChanges` set (no activity recreation). If it does not, fall back
  to a `Dimensions.addEventListener('change', …)` subscription inside `useResponsiveLayout` — the
  seam is deliberately one hook so this stays a local fix.
- **Window vs. device metrics in split-screen.** `useWindowDimensions` reports the app window, not
  the display. Multi-window on a tablet can therefore report a phone-class smallest width. That is
  the intended behavior here (layout follows available space), but confirm the reported values in
  Android split-screen before treating the size class as a device class anywhere.
- **`orientation: "default"` scope.** Expo's `orientation` field is global; SDK 56 has no
  per-size-class option. Confirm no per-screen orientation lock is needed for the live workout
  screen before shipping, since unlocking applies to phones too.
- **Safe-area insets in landscape.** Confirm `insets.left` / `insets.right` are actually non-zero
  on the target emulators before asserting on them in a test; if the emulators report zero, keep
  the padding code and cover it with a mocked-inset unit test only.

## Data Model

No persisted data changes. Session, preference, and storage shapes are untouched; layout is
derived from window dimensions on every render.

### New: `src/theme/breakpoints.ts`

```ts
// Android sw-qualifier convention: 600dp ≈ 7" tablet, 840dp ≈ 10" tablet.
export const breakpoints = { phone: 0, tablet: 600, tabletLg: 840 } as const;

export type SizeClass = 'phone' | 'tablet' | 'tabletLg';
export type Orientation = 'portrait' | 'landscape';

// Minimum *current* width before a master/detail split is worth showing.
export const TWO_PANE_MIN_WIDTH = 720;

// Per-size-class layout metrics. No screen hardcodes these numbers.
export const responsive = {
  contentMaxWidth: { phone: null, tablet: 640, tabletLg: 760 },
  containerPadding: { phone: 20, tablet: 32, tabletLg: 40 },
  statColumns: { phone: 2, tablet: 4, tabletLg: 4 },
  bpmFontSize: { phone: 64, tablet: 88, tabletLg: 96 },
  bpmIconSize: { phone: 36, tablet: 48, tabletLg: 52 },
  masterPaneWidth: { phone: null, tablet: 320, tabletLg: 380 },
} as const;
```

`contentMaxWidth.phone` is `null`, meaning "full bleed" — an explicit absence rather than a
sentinel number, so the consumer branches instead of comparing against `Infinity`.

The size class is resolved from the **smallest** window dimension, matching Android's
`smallestScreenWidthDp`. This is what keeps the class stable across rotation (a 7" tablet is
`tablet` in both orientations) and what keeps a phone in landscape — 800dp wide, 360dp tall —
classified as `phone` rather than promoted to tablet typography. The two-pane decision instead
uses the _current_ width, because fitting two panes needs real horizontal room: a 7" tablet is
single-pane in portrait (600dp) and two-pane in landscape (960dp).

### Changed: `src/theme/index.ts`

Re-exports `breakpoints`, `responsive`, `resolveSizeClass`, `shouldUseTwoPane`,
`TWO_PANE_MIN_WIDTH`, and the `SizeClass` / `Orientation` types, so consumers keep importing from
`@/theme` only.

## Interfaces / API

### New: `src/theme/breakpoints.ts` (pure)

```ts
// Size class from the smaller window dimension (Android smallestScreenWidthDp).
export function resolveSizeClass(smallestWidth: number): SizeClass;

// Two panes require a non-phone class AND enough current width.
export function shouldUseTwoPane(width: number, sizeClass: SizeClass): boolean;
```

`resolveSizeClass` returns `'tabletLg'` at `>= 840`, `'tablet'` at `>= 600`, else `'phone'`.
Non-finite or negative input falls back to `'phone'`. `shouldUseTwoPane` returns
`sizeClass !== 'phone' && width >= TWO_PANE_MIN_WIDTH`.

### New: `src/hooks/useResponsiveLayout.ts`

```ts
export interface ResponsiveLayout {
  width: number;
  height: number;
  sizeClass: SizeClass;
  orientation: Orientation;
  isTablet: boolean; // sizeClass !== 'phone'
  isTwoPane: boolean;
  contentMaxWidth: number | null;
  containerPadding: number;
  statColumns: number;
  bpmFontSize: number;
  bpmIconSize: number;
  masterPaneWidth: number | null;
}

export function useResponsiveLayout(): ResponsiveLayout;
```

The **only** call site of `useWindowDimensions` in the codebase. Every derived value is memoized
on `[width, height]`. Screen tests mock this hook; the hook's own test mocks
`useWindowDimensions`.

### New: `src/components/ResponsiveContent.tsx`

```ts
export interface ResponsiveContentProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  fullBleed?: boolean; // opt out of the max-width clamp (default false)
}
```

Centers its children, applying `maxWidth: contentMaxWidth` and
`paddingHorizontal: containerPadding` from `useResponsiveLayout`. On a phone it renders 20px
padding and no clamp — visually identical to today's screens. This is the one wrapper every screen
uses to satisfy "no horizontal scrolling at any width".

### New: `src/hooks/useSessionHistory.ts`

```ts
export interface SessionHistory {
  entries: SessionIndexEntry[];
  refresh: () => void;
  remove: (id: string) => void;
}

export function useSessionHistory(): SessionHistory;
```

Wraps `getSessionIndex` / `deleteSession` and the `useFocusEffect` refresh currently inlined in
`history.tsx`. `remove` deletes and drops the entry from local state. Storage calls are wrapped per
the crash-logging requirement.

### New: `src/hooks/useSessionDetail.ts`

```ts
export interface SessionDetail {
  session: PersistedSession | null;
  remove: () => void;
}

export function useSessionDetail(id: string | null): SessionDetail;
```

Wraps `getSession` / `deleteSession`. Returns `session: null` for a null or unknown id — the
placeholder and not-found paths share one branch.

These two hooks exist because the list and summary bodies move into `components/`, and the layering
contract forbids `components/` importing `services/`. The screens under `src/app/` keep their
existing freedom to call services directly; nothing about that rule changes.

### New: `src/components/SessionHistoryList.tsx`

```ts
export interface SessionHistoryListProps {
  entries: SessionIndexEntry[];
  selectedId?: string | null; // highlight + accessibilityState.selected; two-pane only
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}
```

The `FlatList` and the empty state lifted verbatim from `history.tsx`. `onDelete` receives the id
after the caller's confirmation `Alert`, keeping `Alert` out of `components/`.

### New: `src/components/SessionSummaryView.tsx`

```ts
export interface SessionSummaryViewProps {
  sessionId: string | null;
  variant?: 'screen' | 'pane'; // default 'screen'
  onDeleted?: (id: string) => void;
}
```

The summary body lifted from `summary/[id].tsx`, including the `HealthConnectSyncBadge` and the
delete pill. Three states: a session (full summary), `sessionId === null` (a "select a session"
placeholder, reachable only from the two-pane right pane), and a non-null id with no stored session
(today's not-found state). `variant: 'pane'` suppresses the `HeaderBar` and the "back to history"
link, both of which are meaningless inside a pane. `onDeleted` lets the caller decide what follows
deletion: `router.replace('/history')` on the route, clearing the selection in the pane.

### Changed: `src/components/BpmReadout.tsx`

```ts
export interface BpmReadoutProps {
  bpm: number | null;
  fontSize?: number; // default responsive.bpmFontSize.phone (64)
  iconSize?: number; // default responsive.bpmIconSize.phone (36)
}
```

Defaults come from the theme tokens, so the phone rendering is unchanged and the component stays
free of layout logic — the caller passes what `useResponsiveLayout` resolved. `lineHeight` is
derived from `fontSize` at the existing 72/64 ratio.

### Changed: `app.json`

`expo.orientation`: `"portrait"` → `"default"`. Nothing else in the file changes; no new
permission, plugin, or `android` key.

## Files Created

| File                                               | Purpose                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/theme/breakpoints.ts`                         | Breakpoint tokens, per-size-class layout metrics, and the two pure resolver functions.  |
| `src/hooks/useResponsiveLayout.ts`                 | The single `useWindowDimensions` consumer; turns window size into a `ResponsiveLayout`. |
| `src/components/ResponsiveContent.tsx`             | Centering max-width + padding wrapper used by every screen.                             |
| `src/hooks/useSessionHistory.ts`                   | Session-index read/refresh/delete, so the list can live in `components/`.               |
| `src/hooks/useSessionDetail.ts`                    | Single-session read/delete, so the summary body can live in `components/`.              |
| `src/components/SessionHistoryList.tsx`            | Reusable session list + empty state, with optional selection highlight.                 |
| `src/components/SessionSummaryView.tsx`            | Reusable summary body in `screen` and `pane` variants, plus the placeholder state.      |
| `src/tests/theme/breakpoints.test.ts`              | Boundary coverage for `resolveSizeClass` and `shouldUseTwoPane`.                        |
| `src/tests/hooks/useResponsiveLayout.test.tsx`     | Derived-value coverage at phone / 7" / 10" widths in both orientations.                 |
| `src/tests/hooks/useSessionHistory.test.ts`        | Refresh and remove behavior against the MMKV mock.                                      |
| `src/tests/hooks/useSessionDetail.test.ts`         | Found, not-found, and null-id cases.                                                    |
| `src/tests/components/ResponsiveContent.test.tsx`  | Clamp applied on tablet widths, absent on phone.                                        |
| `src/tests/components/SessionHistoryList.test.tsx` | Rendering, empty state, selection state, and callbacks.                                 |
| `src/tests/components/SessionSummaryView.test.tsx` | All three states and both variants.                                                     |

## Files Modified

| File                                        | Change                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.json`                                  | `orientation`: `"portrait"` → `"default"`, so tablets (and phones) can rotate.                                                                                                      |
| `src/theme/index.ts`                        | Re-export the breakpoint tokens, resolvers, and types.                                                                                                                              |
| `src/app/(tabs)/(history)/history.tsx`      | Delegate to `useSessionHistory` + `SessionHistoryList`; own the delete `Alert`; branch on `isTwoPane` into a master/detail row or the phone list-plus-push.                         |
| `src/app/(tabs)/(history)/summary/[id].tsx` | Reduce to route plumbing: params → `SessionSummaryView variant="screen"` inside `ResponsiveContent`, with `router.replace('/history')` on delete.                                   |
| `src/app/(tabs)/workout.tsx`                | Wrap content in `ResponsiveContent`; on `isTablet` render the readout column beside the stats column and lay the stats grid out in `statColumns`; pass the resolved BPM sizes down. |
| `src/components/BpmReadout.tsx`             | Accept optional `fontSize` / `iconSize`, defaulted from the theme tokens.                                                                                                           |
| `src/components/HeaderBar.tsx`              | Add `insets.left` / `insets.right` padding for landscape cutouts.                                                                                                                   |
| `src/components/BottomNavBar.tsx`           | Add `insets.left` / `insets.right` padding for landscape cutouts.                                                                                                                   |
| `src/app/(tabs)/index.tsx`                  | Wrap the pairing content in `ResponsiveContent` (max-width only; no restructure).                                                                                                   |
| `src/app/(tabs)/settings.tsx`               | Wrap the settings content in `ResponsiveContent` (max-width only; no restructure).                                                                                                  |
| `src/services/i18n/translations/en.json`    | Add `history.selectSessionTitle` and `history.selectSessionMessage`.                                                                                                                |
| `src/services/i18n/translations/ja.json`    | Same two keys, translated — `localeCoverage.test.ts` fails otherwise.                                                                                                               |
| `src/tests/app/history.test.tsx`            | Mock `useResponsiveLayout`; assert push-on-phone vs. inline-detail-on-tablet.                                                                                                       |
| `src/tests/app/summary/[id].test.tsx`       | Keep behavioral assertions against the slimmed route.                                                                                                                               |
| `src/tests/app/workout.test.tsx`            | Add tablet-layout assertions and the mid-session rotation regression test.                                                                                                          |
| `src/tests/components/BpmReadout.test.tsx`  | Cover the size props and the phone defaults.                                                                                                                                        |
| `docs/ui-reference/design.md`               | Add a Breakpoints subsection under "Layout & Spacing" recording the 600/840dp classes and the 720dp two-pane threshold.                                                             |
| `README.md`                                 | Note tablet/landscape support in the features list.                                                                                                                                 |

## Implementation Steps

1. Add `src/theme/breakpoints.ts` with the tokens, `resolveSizeClass`, and `shouldUseTwoPane`;
   re-export from `src/theme/index.ts`. Write `src/tests/theme/breakpoints.test.ts` covering
   359/360, 599/600, 839/840, the two-pane threshold at 719/720, and the non-finite fallback.
2. Add `src/hooks/useResponsiveLayout.ts` over `useWindowDimensions`, memoized on
   `[width, height]`. Write `src/tests/hooks/useResponsiveLayout.test.tsx`, mocking
   `useWindowDimensions` via a `jest.mock('react-native', …)` that spreads
   `jest.requireActual('react-native')`, and assert phone portrait (411×891), phone landscape
   (891×411 → still `phone`, `isTwoPane: false`), 7" portrait (600×960 → `tablet`, single pane),
   7" landscape (960×600 → `tablet`, two-pane), and 10" landscape (1280×800 → `tabletLg`,
   two-pane).
3. Add `src/components/ResponsiveContent.tsx` and its test. Verify a phone render still produces
   20px horizontal padding and no `maxWidth`.
4. Flip `app.json` `orientation` to `"default"`. Run `pnpm android` and confirm the regenerated
   `android/app/src/main/AndroidManifest.xml` no longer carries
   `android:screenOrientation="portrait"` while `configChanges` still lists `orientation` and
   `screenSize`.
5. Add `insets.left` / `insets.right` padding to `HeaderBar` and `BottomNavBar`, preserving both
   existing `try`/`catch` zero-inset fallbacks. Extend their component tests with a mocked
   non-zero-side-inset case.
6. Add `useSessionHistory` and `useSessionDetail`, wrapping every storage call for
   `crashService.reportError`. Cover both with tests against the existing `react-native-mmkv`
   mock.
7. Extract `SessionHistoryList` from `history.tsx` — list, empty state, and the optional
   `selectedId` highlight with `accessibilityState={{ selected }}`. Test it directly.
8. Extract `SessionSummaryView` from `summary/[id].tsx` with its three states and two variants. Add
   the two `history.select*` i18n keys to `en.json` and `ja.json` for the placeholder. Test every
   state/variant combination.
9. Rewrite `history.tsx`: `useSessionHistory` + `useResponsiveLayout`. On `isTwoPane`, render a row
   of `SessionHistoryList` at `masterPaneWidth` beside `SessionSummaryView variant="pane"`,
   auto-selecting the newest entry when nothing is selected and clearing the selection when the
   selected session is deleted. Otherwise render the list alone and keep
   `router.push('/summary/<id>')`. Keep the delete `Alert` in the screen.
10. Slim `summary/[id].tsx` to params → `ResponsiveContent` → `SessionSummaryView`
    `variant="screen"`, with `onDeleted` calling `router.replace('/history')`. This route stays
    reachable on tablets — the stop-workout effect in `workout.tsx` navigates straight to it.
11. Add the optional `fontSize` / `iconSize` props to `BpmReadout`, defaulted from
    `responsive.bpmFontSize.phone` / `responsive.bpmIconSize.phone`, and extend its test.
12. Restructure `workout.tsx`: wrap in `ResponsiveContent`; on `isTablet`, render duration +
    `BpmReadout` + `HrZoneBar` in one column and the stats grid + controls in a second; chunk the
    four `StatCard`s by `statColumns` so tablets get one row of four; pass the resolved BPM sizes
    down. Leave the phone branch structurally as-is. Do not touch `useWorkoutSession` or
    `workoutSessionStore`.
13. Wrap `src/app/(tabs)/index.tsx` and `src/app/(tabs)/settings.tsx` in `ResponsiveContent`.
14. Update `src/tests/app/history.test.tsx`, `summary/[id].test.tsx`, and `workout.test.tsx`. The
    rotation regression test mounts `WorkoutScreen` with an active session, advances the fake
    timer, re-renders with width and height swapped in the mocked layout, and asserts the displayed
    duration keeps advancing and `useWorkoutSessionStore.getState().status` is still `'active'`.
15. Add the Breakpoints subsection to `docs/ui-reference/design.md` and the README note.
16. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Then `pnpm android` and walk pairing, live
    workout (mid-session rotation), history, summary, and settings on three AVDs — a phone
    (~411dp), a 7" tablet (sw600dp), and a 10" tablet (sw800dp) — in both orientations.

## Style & Conventions

- `CLAUDE.md` layering: `theme/` imports nothing from the app, so `breakpoints.ts` is pure and
  unit-testable without a renderer; `components/` reaches storage only through the two new hooks;
  `hooks/` adapt services to React.
- `CLAUDE.md` UI rule — no hardcoded hex, font size, or radius in a component. Every breakpoint,
  padding, column count, and BPM size is a `@/theme` token; screens read them through
  `useResponsiveLayout` and never compare raw widths themselves. That is the issue's "no per-screen
  magic numbers" requirement, enforced structurally.
- Cross-cutting requirements: extracted components keep their existing
  `accessibilityRole` / `Label` / `Hint`, and the two-pane list adds
  `accessibilityState={{ selected }}`; the two new strings go into both translation files; the
  storage calls behind the new hooks report through `src/services/crashService.ts`.
- Android-only: no `ios` block is touched. The existing `ios.supportsTablet: true` is inherited
  scaffolding and stays untouched per `CLAUDE.md`.
- `jest-expo` + `@testing-library/react-native`, mirroring the existing screen tests' local
  `jest.mock('expo-router', …)` pattern.
- Deliberate deviation: `docs/ui-reference/design.md` is the visual source of truth but defines no
  breakpoints, so this feature introduces them and writes them back into that document rather than
  leaving the tokens undocumented.

## Acceptance Criteria

- [ ] `resolveSizeClass` and `shouldUseTwoPane` are covered at every boundary, and no file outside
      `src/theme/breakpoints.ts` contains a raw width comparison —
      `grep -rn "useWindowDimensions" src/` matches only `src/hooks/useResponsiveLayout.ts`.
- [ ] On a two-pane width, `history.tsx` renders the selected session's summary inline and does
      **not** call `router.push`; on a phone width it renders the list only and pushes
      `/summary/<id>` on press. Both directions are asserted in `src/tests/app/history.test.tsx`.
- [ ] The live workout screen renders the four stat cards in a single row and an enlarged BPM
      readout at tablet widths, and keeps its current two-row grid and 64px readout on a phone.
- [ ] Rotating a tablet mid-session keeps the timer advancing and the session `'active'`: covered
      by the `workout.test.tsx` rotation test and confirmed by hand on a tablet AVD.
- [ ] No screen requires horizontal scrolling at 360dp, sw600dp, or sw800dp in either orientation,
      and no content stretches full-bleed past `contentMaxWidth` on a tablet.
- [ ] The generated `AndroidManifest.xml` has no `android:screenOrientation="portrait"` on
      `MainActivity`, and still declares `orientation` and `screenSize` in `configChanges`.
- [ ] `history.selectSessionTitle` and `history.selectSessionMessage` exist in both `en.json` and
      `ja.json`; `src/tests/services/i18n/localeCoverage.test.ts` passes.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.

## Constraints

- **Non-goal: web.** Per the issue and `CLAUDE.md`, the Web Bluetooth graceful-degradation path in
  `docs/specs.md:56` is deliberately not implemented — this project is Android-only and a web build
  would have no BLE path worth maintaining. Recorded so the trade-off is documented rather than
  forgotten.
- **Non-goal: redirecting the summary route on wide screens.** `/summary/<id>` stays a real route
  on every size class, because `workout.tsx` navigates to it directly after Stop. Rewriting that
  into a two-pane selection is a separate change.
- **Non-goal: pairing and settings restructures.** Those two screens get the max-width clamp only.
  Multi-column pairing or a settings master/detail is out of scope.
- **Non-goal: new persistence.** Rotation survivability rests on the activity not being recreated
  (`configChanges`) plus session truth living in `workoutSessionStore`. No state rehydration or
  `AppState` work is added. If a device is ever found that recreates the activity on rotation, that
  is a follow-up.
- **Non-goal: Maestro coverage.** E2E for two-pane history can be added later; this spec's
  verification is unit/component tests plus the three-AVD manual pass.
- Unlocking orientation applies to phones as well as tablets — SDK 56 has no per-size-class option.
  Phone landscape must therefore stay legible, which is why the max-width wrapper and the
  horizontal safe-area insets are in scope rather than deferred.
- Native config change: this ships only in a new build (`pnpm android`, new EAS fingerprint), never
  as an OTA update.
- Fonts remain pending per `CLAUDE.md`; the responsive size tokens set `fontSize` only and must not
  start applying `fontFamily`.
