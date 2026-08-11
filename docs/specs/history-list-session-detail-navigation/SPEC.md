# Feature: History List → Session Detail Navigation

## Intent

`history.tsx` becomes a real `FlatList` of every persisted session — newest first, each
row showing a relative date, duration, and avg HR (or a dash) — that opens the matching
`summary/[id]` on tap, deletes on long-press with the same confirmation `summary/[id]`
already uses, and shows a first-run empty state, all without re-deriving anything the
storage layer doesn't already give it for free.

## Context

- **Problem statement:** [Issue #14](https://github.com/alvinyanson/fitness-tracker/issues/14)
  — `docs/specs.md:36-40` (Milestone 1.4). `src/app/history.tsx` is still the scaffold stub
  from `docs/specs/expo-router-src-scaffold/SPEC.md`: a static title and one `Link` to the
  literal `/summary/demo`, which `docs/specs/session-summary-screen/SPEC.md` (issue #13,
  merged) explicitly left in place, calling the real list "a separate, not-yet-filed issue;
  out of scope here." This issue is that issue.
- **Current code:**
  - `src/services/storage/sessionHistoryStorage.ts` already exports
    `getSessionIndex(): SessionIndexEntry[]`, returning entries sorted newest-first
    (descending `startedAt`) and `deleteSession(id): void`, both built and unit-tested by
    issue #13. This spec adds no new storage function — the list screen is a pure consumer
    of these two.
  - `src/interfaces/session.ts`'s `SessionIndexEntry` (`id`, `startedAt`, `endedAt`,
    `durationMs`, `avgHr`) is already the "lightweight per-session summary for a future
    history list" its own doc comment names — exactly the shape this screen needs, no
    sample series. No change to this interface.
  - `src/app/summary/[id].tsx` (issue #13, merged) already renders one persisted session
    from storage and owns the one delete confirmation pattern in the app: `Alert.alert`
    with `summary.deleteTitle`/`deleteMessage`/`deleteCancel`(cancel)/`deleteConfirm`
    (destructive), calling `deleteSession(id)` then `router.replace('/history')` on
    confirm. This issue's row-level delete reuses that exact shape (same four strings, same
    `Alert.alert` call shape) rather than inventing a second confirmation mechanism —
    literally "reusing the summary screen's delete path" per the issue's own scope bullet.
  - `src/components/BottomNavBar.tsx` already derives `activeRoute === 'history'` for both
    `/history` and any `/summary/*` path, and both `history.tsx` and `summary/[id].tsx`
    already render `<BottomNavBar currentRoute="history" />` — unchanged by this issue.
  - `src/components/DeviceListItem.tsx` is this repo's one existing "row component driven
    by a typed prop + onPress callback" precedent (pairing screen's device list) — this
    issue's new row component follows the same shape: a typed props interface, no direct
    storage/store import, `useTranslation()` for copy, a trailing `StyleSheet.create` from
    `@/theme` tokens only.
  - `docs/ui-reference/history.png` — reference only, per `CLAUDE.md`. It shows a "Lifetime
    Stats" card (total workouts / avg duration) above "Past Sessions", a "Filter" pill, and
    relative date group labels ("TODAY" / "YESTERDAY" / "OCT 24, 2023"). The lifetime-stats
    card and the filter pill are **not** built here — see Constraints; this issue scopes to
    the list itself (row content, tap, delete, empty state), matching the issue's own scope
    bullets, none of which mention aggregate stats or filtering.
  - `expo-router` re-exports `useFocusEffect` (`node_modules/expo-router/build/exports.d.ts`)
    — the mechanism this screen uses to refresh its index on screen focus, since
    `sessionHistoryStorage` is a plain MMKV wrapper with no reactive store to subscribe to
    (unlike `workoutSessionStore`/`settingsStore`, which are zustand).
  - `src/app/_layout.tsx` already wraps the whole app in `GestureHandlerRootView` (for
    `expo-router`'s own use), so `react-native-gesture-handler` primitives are available if
    a later issue wants a swipe gesture — this issue does not add one; see Constraints.
- **User impact:** Users can browse every session they've ever recorded, newest first, with
  duration and avg HR visible without opening each one, reopen any of them, remove ones
  they don't want, and get sensible copy on a fresh install where no session exists yet
  instead of a stub link to a session that doesn't exist.
- **Dependencies:** Depends on #13 (`docs/specs/session-summary-screen/SPEC.md`, merged) for
  both the storage layer and the delete-confirmation shape being reused. No new package.

## Data Model

N/A — no new or changed types. This screen is a pure reader of the existing
`SessionIndexEntry[]` (`src/interfaces/session.ts:54-60`) via the existing
`getSessionIndex()`/`deleteSession()` (`src/services/storage/sessionHistoryStorage.ts`),
both already implemented and unit-tested by issue #13.

## Interfaces / API

### `src/components/HistoryListItem.tsx` (new — the generic list→detail row)

```ts
export interface HistoryListItemProps {
  id: string;
  dateLabel: string;
  durationLabel: string;
  avgHrLabel: string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function HistoryListItem(props: HistoryListItemProps): ReactNode;
```

- Purely presentational: every string it renders is already formatted by the caller (date
  label, duration, avg HR display) — it does not import `formatDate`, `formatDuration`, or
  any storage/store module, matching `DeviceListItem.tsx`'s "typed props in, no data
  fetching" shape. This is what keeps it the reusable list-row component the issue asks for
  ("keep the row component generic") — a future second list (e.g. a filtered view, or a
  different session type) reuses it by passing different label strings, not by teaching it
  a new data shape.
- Fixed content per row, following `docs/ui-reference/history.png`'s row layout: a
  dumbbell-icon avatar (reusing `MaterialCommunityIcons` `"dumbbell"`, the same icon
  `BottomNavBar`'s workout tab already uses, at the same tint), the `dateLabel` as a small
  caps line above a fixed session-type title (`history.sessionTitle`, since only one
  session type — HR-monitored workout — exists in this app; a future session-type field
  would extend this prop, not this issue), then `durationLabel` and `avgHrLabel` each next
  to a small icon (clock / heart), and a trailing chevron affordance matching the mockup.
  No unit suffix baked in — `avgHrLabel` arrives pre-formatted as `"142 BPM"` or `"—"` by
  the caller, mirroring `summary/[id].tsx`'s existing `stats.avgHr !== null ? ... : '—'`
  dash convention.
- `onPress`/`onLongPress` both receive `id`; the component wraps its content in one
  `Pressable` with both handlers, `accessibilityRole="button"`, `delayLongPress` left at
  the RN default (500ms).

### `src/utils/formatRelativeDate.ts` (new — pure, mirrors `formatDate.ts`)

```ts
export function formatRelativeDate(
  date: Date,
  now: Date,
  locale: LocaleCode,
): string;
```

- Returns `history.today`/`history.yesterday` (translated) when `date` falls on the same
  calendar day as `now` / the day before it (local calendar day, not a rolling 24h window —
  a session started at 11:58pm and one at 12:02am the next day are "today" and "yesterday"
  relative to a `now` of that same next day, matching the mockup's plain-language framing),
  otherwise falls back to `formatDate(date, locale, { dateStyle: 'medium' })` (e.g. "Oct 24,
  2023") — reusing the existing formatter rather than a second date-formatting path.
  Deliberately takes `now` as an explicit parameter (not `new Date()` internally) so it
  stays pure and unit-testable without mocking the system clock, matching this repo's
  existing precedent (`computeSessionStats(session, now?)` in `sessionStats.ts`).
- Lives in `utils/`, not `services/`, matching `formatDate.ts`'s existing placement — both
  are locale-aware pure string formatters with no session-domain knowledge.

### `src/app/history.tsx` (rewritten, not scaffold)

- No new exported surface — same default-export screen component `expo-router` already
  resolves for the `/history` route.
- Internal shape:
  - `const [entries, setEntries] = useState<SessionIndexEntry[]>(() => getSessionIndex())`
    — synchronous initial read (MMKV is synchronous), no loading state needed, matching
    `summary/[id].tsx`'s existing `useMemo(() => getSession(id), [id])` precedent for
    synchronous storage reads.
  - `useFocusEffect(useCallback(() => { setEntries(getSessionIndex()); }, []))` — refetches
    once per screen focus (covers "recording two sessions puts the newer one on top": the
    second session is saved by `persistCompletedSession` before `workout.tsx` navigates to
    its summary, and returning to `/history` from there re-focuses this screen). This is
    the one and only re-fetch trigger; render itself never calls `getSessionIndex()` again,
    satisfying the issue's "no re-parsing the whole store on every render" bullet.
  - `FlatList` over `entries`, `keyExtractor={(entry) => entry.id}` (stable — `id` is
    `String(startedAt)`, immutable per entry, satisfying "stable keys"), `renderItem`
    builds one `HistoryListItem` per entry with the caller-formatted labels:
    - `dateLabel: formatRelativeDate(new Date(entry.startedAt), new Date(), language)`
    - `durationLabel: formatDuration(Math.floor(entry.durationMs / 1000))`
    - `avgHrLabel: entry.avgHr !== null ? `${entry.avgHr} ${t('summary.avgHr')... }`— see
Implementation Steps for the exact composed string; falls back to`'—'`when`entry.avgHr === null`, mirroring `summary/[id].tsx`'s existing dash convention.
  - `onPress`: `router.push(\`/summary/${id}\`)`.
  - `onLongPress`: the same `Alert.alert` shape `summary/[id].tsx` uses
    (`summary.deleteTitle`/`deleteMessage`/`deleteCancel`/`deleteConfirm`) — confirming
    calls `deleteSession(id)` then updates local state via
    `setEntries((prev) => prev.filter((entry) => entry.id !== id))` (no re-read from
    storage needed; the delete already tells this screen exactly what changed) — satisfies
    "deleting from the list updates it without a reload."
  - Empty state (`entries.length === 0`): centered `history.emptyTitle`/`emptyMessage`
    (no `FlatList`), matching `summary/[id].tsx`'s not-found branch's layout shape
    (`HeaderBar` + centered icon/title/message + `BottomNavBar`) for a consistent empty/error
    visual language across the app.
  - `HeaderBar title={t('history.title')} showSignalIcon={false}` (no device badge — same
    reasoning `summary/[id].tsx` already gives for its own header) + `BottomNavBar
currentRoute="history"`.

## Files Created

| File                                            | Purpose                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/HistoryListItem.tsx`            | Generic, presentational list→detail row; press/long-press callbacks only.            |
| `src/utils/formatRelativeDate.ts`               | Pure "Today"/"Yesterday"/formatted-date label, given an explicit `now`.              |
| `src/tests/components/HistoryListItem.test.tsx` | Renders given labels; press/long-press call their respective handlers with `id`.     |
| `src/tests/utils/formatRelativeDate.test.ts`    | Today/yesterday/older-date cases, locale passthrough, day-boundary edge cases.       |
| `src/tests/app/history.test.tsx`                | Screen tests: list render/order, tap navigates, long-press delete flow, empty state. |

## Files Modified

| File                                     | Change                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/app/history.tsx`                    | Replaced scaffold stub with the real `FlatList` screen per Interfaces/API above.              |
| `src/services/i18n/translations/en.json` | Add `history.*` keys (see Implementation Steps); remove now-unused `history.viewDemoSummary`. |
| `src/services/i18n/translations/ja.json` | Japanese equivalents for the same keys, keeping `localeCoverage.test.ts` passing.             |

## Implementation Steps

1. Add `src/utils/formatRelativeDate.ts` per the Interfaces/API contract: compare `date`'s
   and `now`'s local calendar day (`toDateString()` equality, or explicit
   year/month/day comparison) to decide today/yesterday/fallback; fallback calls the
   existing `formatDate(date, locale, { dateStyle: 'medium' })`. Returns translated
   `history.today`/`history.yesterday` strings — take `t: (key: string) => string` or the
   two literal translated strings as a parameter rather than importing `useTranslation`
   directly (keeps this a pure, hook-free utility per `utils/`'s layering rule: no React).
2. Write `src/tests/utils/formatRelativeDate.test.ts`: same-day → today label; `now` one
   calendar day after `date` → yesterday label; two-plus days apart → the `formatDate`
   fallback string; a `date` just before midnight and `now` just after → correctly
   "yesterday", not "today" (the calendar-day-boundary case the doc comment calls out).
3. Add `src/components/HistoryListItem.tsx` per its contract: `Pressable` wrapping the
   dumbbell-avatar + `dateLabel`/title/`durationLabel`/`avgHrLabel`/chevron layout,
   `onPress`/`onLongPress` wired to the `Pressable`'s own props, `StyleSheet.create` from
   `@/theme` tokens only, no hardcoded hex/size/radius, no `fontFamily` per `CLAUDE.md`'s
   "fonts are pending" rule.
4. Write `src/tests/components/HistoryListItem.test.tsx` with
   `@testing-library/react-native`: renders the three passed labels; `fireEvent.press`
   calls `onPress(id)`; `fireEvent(el, 'longPress')` calls `onLongPress(id)`.
5. Add `history.*` translation keys to `en.json` (and Japanese equivalents to `ja.json`):
   `history.title` (keep), `history.sessionTitle` ("Heart Rate Session"), `history.today`
   ("Today"), `history.yesterday` ("Yesterday"), `history.emptyTitle` ("No Sessions Yet"),
   `history.emptyMessage` ("Complete a workout to see it appear here."),
   `history.avgHrUnit` ("BPM", used to compose the row's avg-HR label). Remove
   `history.viewDemoSummary` (its only call site, the scaffold's demo `Link`, is deleted in
   step 6). Run `pnpm test -- localeCoverage` to confirm parity.
6. Rewrite `src/app/history.tsx` per the Interfaces/API contract: `useState` seeded from
   `getSessionIndex()`, `useFocusEffect` refetch, `FlatList` with `HistoryListItem` rows,
   `onLongPress`'s `Alert.alert` + `deleteSession` + local-state filter, empty-state branch,
   `HeaderBar`/`BottomNavBar` matching `summary/[id].tsx`'s established per-screen
   composition.
7. Write `src/tests/app/history.test.tsx` with `@testing-library/react-native`, mocking
   `expo-router` the same way `src/tests/app/summary/[id].test.tsx` does (`router.push`,
   `useFocusEffect` — either mock it to run its callback once on mount, matching
   `@testing-library/react-native`'s and expo-router's own testing-library conventions, or
   import the real one if `expo-router/testing-library` already wraps focus lifecycle;
   check `node_modules/expo-router/testing-library.d.ts` for the supported approach before
   choosing), pre-seeding MMKV via `saveSession` for 2+ sessions with distinct `startedAt`s:
   - Renders both sessions with the newer `startedAt` first (asserts render order, not just
     presence).
   - A session with `avgHr: null` renders the `'—'` fallback, not a `null`/`NaN` string.
   - Pressing a row calls `router.push` with `` `/summary/${id}` ``.
   - Long-pressing a row shows the `summary.deleteTitle`/`deleteMessage` confirm (same
     assertions style as `summary/[id].test.tsx`'s delete-flow tests); confirming removes
     the row from the rendered list without needing a remount (asserts via `queryByText`
     the deleted row's content is gone) and calls `deleteSession` (verified via
     `getSessionIndex()` no longer containing that id); cancelling leaves both rows.
   - Zero sessions in storage renders `history.emptyTitle`/`emptyMessage`, no `FlatList`
     rows.
8. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`.
9. Manual/device verification (per Acceptance Criteria — needs `pnpm android`): record two
   sessions back-to-back, confirm the newer one is on top and both open correctly from the
   list; long-press a row, confirm delete, confirm the list updates immediately with no
   pull-to-refresh/reload needed; force-quit with zero sessions ever recorded (fresh
   install / cleared app data) and confirm the empty state renders instead of a blank list.

## Style & Conventions

- `HistoryListItem.tsx` follows `DeviceListItem.tsx`'s exact shape: typed props, no
  data-layer imports, `useTranslation()` only for its own fixed copy (the session-type
  title), a single trailing `StyleSheet.create` from `@/theme` tokens.
- `history.tsx` follows `summary/[id].tsx`'s and `workout.tsx`'s established per-screen
  composition (`HeaderBar` + main content + `BottomNavBar`, `useTranslation()` for every
  string, theme-only styles).
- The delete confirmation reuses `summary/[id].tsx`'s exact `Alert.alert` shape and
  `summary.*` string keys verbatim — no new confirmation abstraction, no new translation
  keys for the same four delete strings.
- `formatRelativeDate.ts` sits beside `formatDate.ts` in `utils/`, takes an explicit `now`
  parameter rather than reading the system clock, matching `computeSessionStats`'s existing
  explicit-`now` precedent for testability.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior spec's
  convention in this repo.
- One-line comments only in code; rationale lives in this SPEC's prose, per this project's
  comment-density convention.

## Acceptance Criteria

- [ ] Recording two sessions and returning to `/history` shows the newer one first; tapping
      either opens the matching `summary/[id]` and renders that session's data.
- [ ] Long-pressing a row shows the same delete confirmation `summary/[id].tsx` uses;
      cancelling leaves the row and its stored session; confirming removes the row from the
      visible list immediately (no navigation, no full-screen reload) and removes the
      session from storage (`getSessionIndex()`/`getSession(id)` reflect the deletion).
- [ ] A session with `avgHr === null` renders a dash for avg HR instead of a blank or
      `NaN`/`null` string.
- [ ] A fresh install (empty `getSessionIndex()`) renders the empty state, not an empty
      `FlatList` or the old demo link.
- [ ] `FlatList` uses a stable `keyExtractor` and the render path performs no per-render
      storage re-read — only the focus-triggered refetch and the delete-triggered local
      state update touch storage.
- [ ] `pnpm test` passes, including every new/modified suite, with `react-native-mmkv`
      mocked — no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] Verified on a dev-client build (`pnpm android`) per the issue's own acceptance
      criteria.

## Constraints

- **Android only**, per `CLAUDE.md` — nothing platform-specific is introduced beyond what
  the app already targets.
- **No "Lifetime Stats" card.** `docs/ui-reference/history.png`'s total-workouts/avg-duration
  summary card is not in the issue's scope bullets (list, tap, empty state, delete,
  performance) and would need an aggregate reduction over every stored session with no
  existing service for it; deliberately deferred rather than built speculatively.
- **No "Filter" control.** Same reasoning — the mockup shows a filter pill with no
  corresponding scope bullet or acceptance criterion in issue #14.
- **Long-press delete, not swipe-to-delete.** The issue says "swipe-or-long-press"; this
  spec picks long-press because it reuses `summary/[id].tsx`'s existing `Alert.alert`
  confirmation with zero new gesture code, while a swipe (`Swipeable` from
  `react-native-gesture-handler`) would introduce this repo's first swipeable-row pattern
  and materially more component-test complexity for no behavior the acceptance criteria
  require beyond "delete updates the list without a reload," which long-press already
  satisfies. A later issue can add swipe as an additional trigger to the same
  `HistoryListItem` without changing its `onLongPress` contract.
- **One session type.** `history.sessionTitle` is a fixed string because
  `PersistedSession`/`SessionIndexEntry` carry no session-type field today; not a
  general-purpose "session type label" mechanism.
- **No pagination/virtination beyond `FlatList` defaults.** `FlatList`'s built-in
  windowing is the only performance measure taken; no manual chunking, `getItemLayout`, or
  pagination is added — out of scope until a real device shows this is insufficient at
  realistic session counts.
- Functional verification of on-device list scrolling feel and the empty-state-on-fresh-install
  path needs a device and `pnpm android` (dev client); unit/component tests here cover
  ordering, formatting, tap/long-press wiring, and the delete/empty-state branches against
  the mocked MMKV module only, per `CLAUDE.md`'s "Expo Go does not work here."
