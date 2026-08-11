# Feature: Live Workout Screen — BPM, Elapsed Timer, Rolling Avg, Reconnecting Indicator

## Intent

`src/app/workout.tsx` renders the actual live-session UI — an animated current-BPM
readout with an explicit no-data state, an elapsed timer with Start/Pause/Resume/Stop
controls, a 30-second rolling-average BPM, and a non-blocking reconnecting indicator —
all driven through `useWorkoutSession`, with Stop and a confirmed hardware-back both
ending the session and leaving for the summary screen, never silently discarding it.

## Context

- **Problem statement:** [Issue #11](https://github.com/alvinyanson/fitness-tracker/issues/11)
  — `docs/specs.md` Milestone 1.2 calls this "the direct equivalent of the weather app's
  icon + temperature" glanceable readout (`docs/specs.md:25-28`). Today
  `src/app/workout.tsx` is the scaffold stub left by
  `docs/specs/expo-router-src-scaffold/SPEC.md`: a title and a `Link` back to `/`, no
  session UI at all. Every piece of state this screen needs already exists —
  `useWorkoutSession` (`docs/specs/workout-session-store/SPEC.md`, merged) drives
  `status`/`reconnecting`/`elapsedMs`/`start`/`pause`/`resume`/`stop` and already wires
  keep-awake, BLE-reconnect detection, and HR-sample ingestion into
  `useWorkoutSessionStore` — but nothing renders it, and the store's `samples` buffer has
  no consumer for "current BPM" or "rolling average" yet.
  - The issue names `bleService` explicitly as the thing the component must **not** talk
    to directly — `useWorkoutSession` already satisfies that; this spec keeps the screen
    talking only to that hook (plus the two new pure/presentational pieces it adds), never
    to `bleService` or `subscribeToHeartRate` directly.
  - "Rolling average BPM over a defined window (state the window in the PR)" — this spec
    picks a **30-second time window** (see Interfaces / API) and states it here per the
    issue's own instruction; the eventual PR description repeats this number.
- **Current code:**
  - `src/hooks/useWorkoutSession.ts` — returns `{ status, reconnecting, elapsedMs,
sampleCount, start, pause, resume, stop }`. It already ingests `HeartRateSample`s into
    `useWorkoutSessionStore.samples` while `active`, but exposes only the count, not the
    latest value or any reduction over the buffer. This spec extends its result rather
    than adding a second hook, since every input the new fields need (`samples`, `status`)
    is already selected inside this hook.
  - `src/store/workoutSessionStore.ts` / `src/interfaces/session.ts` — `samples:
HeartRateSample[]` accumulates for the lifetime of one `active` session, appended only
    while `active`, frozen (not cleared) once `stop()` runs. Unchanged by this spec.
  - `src/services/session/sessionElapsed.ts` — precedent this spec's new
    `rollingAverageBpm.ts` follows directly: a pure function taking an explicit `now`
    parameter instead of calling `Date.now()` itself, so it stays dependency-free and
    trivially unit-testable (`CLAUDE.md`'s "Highest-value coverage is the pure logic in
    `services/`").
  - `src/services/formatDuration.ts` — existing `mm:ss`/`h:mm:ss` formatter, reused as-is
    for the elapsed-timer readout; this spec adds no second time-formatting function.
  - `src/app/index.tsx` — the repo's established screen pattern this spec follows:
    `useTranslation()` for every string, a single `StyleSheet.create` at the bottom built
    from `@/theme` tokens only (no hardcoded hex/size/radius), inline `Pressable` buttons
    for a small, screen-specific action row rather than extracting a button component
    (no `WorkoutControls` component is added here for the same reason `index.tsx` has no
    extracted button-row component).
  - `src/app/summary/[id].tsx` — already a working dynamic-route stub that renders
    whatever `id` param it's given (`history.tsx` already links to `/summary/demo`
    today). No session-history storage or per-session id exists anywhere in the repo yet
    (confirmed: no `sessionStorage`/`sessionHistory` file, no MMKV key beyond
    `deviceStorage`/`settingsStore`) — Milestone 1's "session summary screen" (compute
    avg/max/min, save to local storage) and "history screen" (list, tap-through by id)
    are `docs/specs.md` items 3–4, each its own not-yet-filed issue. See Constraints for
    how this spec routes to summary without inventing that id scheme.
  - `docs/ui-reference/live_workout.png` — reference only, per `CLAUDE.md`: informs the
    big-readout-plus-controls layout below, not a pixel target and not a source of scope
    beyond what issue #11 and `docs/specs.md` already state.
  - No `BackHandler`/`Alert.alert`/`useFocusEffect` usage exists anywhere in the repo
    today (repo-wide search confirms zero matches) — this is the first screen with an
    interceptable-back requirement.
- **User impact:** The live workout screen goes from an unusable stub to the actual
  session UI: users can start a session, watch BPM/elapsed/rolling-avg update live, pause
  and resume, see a non-blocking indicator if the strap drops out of range, and either
  Stop into the summary screen or have a hardware-back attempt caught with a confirm
  prompt instead of silently losing the session.
- **Dependencies:** Depends on #10 (`docs/specs/workout-session-store/SPEC.md`, merged —
  `useWorkoutSession`, `useWorkoutSessionStore`, `getElapsedMs`) and #9
  (`docs/specs/hr-measurement-notifications/SPEC.md`, merged — `HeartRateSample`,
  `subscribeToHeartRate`, consumed transitively through `useWorkoutSession`, not
  re-imported here). No new package: `react-native-reanimated`, `react-native` (for
  `BackHandler`/`Alert`), and `expo-router` (for `useFocusEffect`, `router`) are all
  already dependencies.

## Data Model

No persisted shape changes. One new derived/pure concept:

```ts
// src/services/session/rollingAverageBpm.ts
export const ROLLING_AVERAGE_WINDOW_MS = 30_000;
```

A 30-second window is chosen over a fixed sample count because Heart Rate Measurement
notification frequency is device-dependent (per `docs/specs.md`'s Addendum, straps,
watches, and rebroadcast bridges all speak `0x180D` but at their own cadence) — a
time-based window stays meaningful regardless of notification rate, where a fixed count
(e.g. "last 10 samples") would represent a different span of real time on a fast vs. slow
broadcaster. 30s is short enough to still read as "current effort," not a session-long
average, while smoothing the single-notification jitter a raw BPM readout would otherwise
show.

`UseWorkoutSessionResult` (`src/hooks/useWorkoutSession.ts`) gains two fields; see
Interfaces / API. No change to `WorkoutSessionSnapshot`/`WorkoutSessionState`
(`src/interfaces/session.ts`, `src/store/workoutSessionStore.ts`) — both derived fields
are computed from the existing `samples` array, not stored.

## Interfaces / API

### `src/services/session/rollingAverageBpm.ts` (pure, dependency-free)

```ts
import type { HeartRateSample } from '@/interfaces/heartRate';

export const ROLLING_AVERAGE_WINDOW_MS = 30_000;

/**
 * Average BPM across every sample whose timestamp falls within `windowMs` of `now`.
 * Returns null when no sample falls inside the window (no data yet, or the window has
 * gone stale — e.g. a long reconnect).
 */
export function getRollingAverageBpm(
  samples: HeartRateSample[],
  now: number,
  windowMs: number = ROLLING_AVERAGE_WINDOW_MS,
): number | null;
```

Behavior:

- Filters `samples` to `timestamp >= now - windowMs`, then returns the arithmetic mean of
  their `bpm` values, rounded to the nearest integer (`Math.round`) — BPM is displayed as
  a whole number everywhere else in the app (`HeartRateSample.bpm` itself is an integer).
- Empty filtered set → `null`, not `0` or `NaN` — `0` would read as a real (and alarming)
  reading; the caller renders the same no-data state this produces for "no samples at
  all."
- No mutation of `samples`; no import from `bleService`, React, or React Native — matches
  `sessionElapsed.ts`'s existing precedent exactly.
- Takes `now` explicitly rather than calling `Date.now()`, for the same testability reason
  `getElapsedMs` does.

### `src/hooks/useWorkoutSession.ts` (extended)

```ts
export interface UseWorkoutSessionResult {
  status: WorkoutSessionStatus;
  reconnecting: boolean;
  elapsedMs: number;
  sampleCount: number;
  /** Latest sample's bpm, or null before the first sample ever arrives this session. */
  currentBpm: number | null;
  /** getRollingAverageBpm over the last ROLLING_AVERAGE_WINDOW_MS; null if none in-window. */
  rollingAverageBpm: number | null;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}
```

- `currentBpm` is `samples.length > 0 ? samples[samples.length - 1].bpm : null` — it is
  **not** cleared by `reconnecting`. Per `CLAUDE.md`'s "a disconnect never kills an active
  session," the last known reading stays on screen (frozen) through a drop, with the
  reconnecting indicator (already derived by this hook) doing the job of telling the user
  the number is stale — not the readout itself blanking out. No-data means "zero samples
  this session," e.g. no HR device paired at all (`CLAUDE.md`'s "HR is optional per
  session"), not "currently reconnecting."
- `rollingAverageBpm` is `getRollingAverageBpm(samples, Date.now())` — recomputed on every
  render of this hook (already re-rendering once per second while `active`, per the
  existing ticking effect, plus whenever `samples` changes via the zustand selector); it
  freezes along with everything else while `paused` (no new render is triggered by time
  passing, matching `elapsedMs`'s existing frozen-while-paused behavior) rather than
  needing a second interval.
- Both fields read the existing `samples` selector this hook does not currently expose;
  add `const samples = useWorkoutSessionStore((state) => state.samples);` alongside the
  existing selectors — no new subscription mechanism, no second read of `bleService`.
- No other field changes. `start`/`pause`/`resume`/`stop` signatures are unchanged.

### `src/components/BpmReadout.tsx` (new, presentational)

```ts
export interface BpmReadoutProps {
  bpm: number | null;
}

export function BpmReadout({ bpm }: BpmReadoutProps): ReactNode;
```

- Renders the large numeral (`type.displayMetrics`'s `fontSize`/`fontWeight`/`lineHeight`
  only — no `fontFamily`, per `CLAUDE.md`'s "fonts are pending" rule, matching every
  existing screen's identical omission) or, when `bpm === null`, the no-data copy
  (`workout.noData`, e.g. "--").
  size (`useSharedValue` + `withTiming`, short duration, subtle scale/opacity pulse) keyed
  off `bpm` changing — a `useEffect` triggers the animation whenever the prop value
  differs from its previous render, so re-renders with the same `bpm` (e.g. the 1s tick
  while `active` with no new sample) do not re-trigger it.
- Pure presentational component: takes `bpm`, nothing else — no hook, no store access,
  independently testable and reusable outside this screen (`CLAUDE.md`'s "Build for
  portability").

### `src/components/ReconnectingBanner.tsx` (new, presentational)

```ts
export interface ReconnectingBannerProps {
  visible: boolean;
}

export function ReconnectingBanner({
  visible,
}: ReconnectingBannerProps): ReactNode;
```

- Renders `null` when `!visible`; otherwise a small, non-blocking banner
  (`workout.reconnecting`, reusing the same copy key already used on the pairing screen —
  `pairing.reconnecting`; a new `workout.reconnecting` key is added instead of reusing
  `pairing.reconnecting` across unrelated screens, matching every other screen's existing
  per-screen key namespacing in `en.json`/`ja.json`). Never intercepts touches, renders
  above the readout without covering the Stop control — "non-blocking" per the issue means
  the timer keeps running and Stop stays reachable, which this component enforces simply
  by not being a modal/overlay that captures gestures.

### `src/app/workout.tsx` (rewritten)

- Calls `useWorkoutSession()` for everything: `status`, `reconnecting`, `elapsedMs`,
  `currentBpm`, `rollingAverageBpm`, `start`/`pause`/`resume`/`stop`.
- Elapsed timer: `formatDuration(Math.floor(elapsedMs / 1000))` (existing formatter,
  unchanged).
- Controls, inline `Pressable`s per `status` (mirrors `index.tsx`'s existing inline-button
  convention, not a new shared component):
  - `idle` / `stopped`: Start button only (plus a `Link` back to `/`, kept only in this
    status — see below).
  - `active`: Pause and Stop buttons.
  - `paused`: Resume and Stop buttons.
- `BpmReadout` fed `currentBpm`; a labeled rolling-average line fed `rollingAverageBpm`
  (`workout.rollingAvgLabel`, rendering the no-data placeholder the same way when `null`).
- `ReconnectingBanner` fed `reconnecting`.
- **Stop → summary navigation:** a `useEffect` watching `status`, calling
  `router.replace('/summary/current')` the render after `status` becomes `'stopped'`
  (i.e. reacting to the store's own state transition, not calling `router.replace`
  directly inside the Stop button's `onPress` — so the hardware-back confirm path below
  reaches the exact same navigation by calling `stop()` and letting this effect fire, with
  no duplicated navigation call site). See Constraints for why `'current'` is a
  placeholder segment, not a real session id.
- **Hardware-back confirmation:** a `useFocusEffect` (from `expo-router`) registers a
  `BackHandler.addEventListener('hardwareBackPress', ...)` listener, active only while
  this screen is focused. The handler:
  - Returns `false` (default back behavior) immediately when `status` is `idle` or
    `stopped` — nothing to discard.
  - Otherwise (`active`/`paused`) calls `Alert.alert(t('workout.discardTitle'),
t('workout.discardMessage'), [{ text: t('workout.discardCancel'), style: 'cancel' },
{ text: t('workout.discardConfirm'), style: 'destructive', onPress: stop }])` and returns
    `true`, swallowing the back press — the same `stop()` the Stop button calls, so the
    same stop→navigate effect above fires; no second navigation path is written for this
    case.
- The scaffold's plain `Link href="/"` is kept, but only rendered while `status` is
  `idle` (before the user has pressed Start) — once `active`/`paused`, the only way off
  the screen is Stop or the confirmed hardware-back, satisfying "prompts rather than
  silently discarding" for every exit path this screen offers. There is no in-app header
  back button anywhere in this app (`_layout.tsx` sets `headerShown: false` globally), so
  hardware-back is the only additional exit path that needs guarding.

## Files Created

| File                                                   | Purpose                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/services/session/rollingAverageBpm.ts`            | Pure `getRollingAverageBpm` + `ROLLING_AVERAGE_WINDOW_MS`.                                                       |
| `src/components/BpmReadout.tsx`                        | Large animated current-BPM readout with its own no-data state.                                                   |
| `src/components/ReconnectingBanner.tsx`                | Non-blocking mid-session reconnect indicator.                                                                    |
| `src/tests/services/session/rollingAverageBpm.test.ts` | Unit tests for the pure rolling-average function, no mocks.                                                      |
| `src/tests/components/BpmReadout.test.tsx`             | Renders bpm value and the no-data state; re-render with unchanged bpm.                                           |
| `src/tests/components/ReconnectingBanner.test.tsx`     | Renders nothing when not visible; renders the banner copy when visible.                                          |
| `src/tests/app/workout.test.tsx`                       | Screen test: full Start/Pause/Resume/Stop flow, reconnect banner, back-press confirm/cancel, navigation on stop. |

## Files Modified

| File                                        | Change                                                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/workout.tsx`                       | Replaced the scaffold stub with the full live-session UI described above.                                                                                                                                                                          |
| `src/hooks/useWorkoutSession.ts`            | Adds `currentBpm`/`rollingAverageBpm` to the result, and the `samples` selector they're derived from.                                                                                                                                              |
| `src/tests/hooks/useWorkoutSession.test.ts` | Adds cases for `currentBpm`/`rollingAverageBpm`: no samples, single sample, multiple samples in/out of the 30s window, frozen values while `paused`.                                                                                               |
| `src/services/i18n/translations/en.json`    | Adds `workout.noData`, `workout.rollingAvgLabel`, `workout.reconnecting`, `workout.start`, `workout.pause`, `workout.resume`, `workout.stop`, `workout.discardTitle`, `workout.discardMessage`, `workout.discardCancel`, `workout.discardConfirm`. |
| `src/services/i18n/translations/ja.json`    | Japanese translations for the same keys, keeping `localeCoverage.test.ts` passing.                                                                                                                                                                 |

## Implementation Steps

1. Add `src/services/session/rollingAverageBpm.ts` per the contract above.
2. Write `src/tests/services/session/rollingAverageBpm.test.ts`: empty samples → `null`;
   all samples outside the window → `null`; all inside → correct mean, rounded; a mix of
   in/out-of-window samples → only in-window ones counted; a custom `windowMs` override;
   confirm no mutation of the input array.
3. Extend `src/hooks/useWorkoutSession.ts`: add the `samples` selector, compute
   `currentBpm` and `rollingAverageBpm` per the contract, add both to the returned object.
4. Extend `src/tests/hooks/useWorkoutSession.test.ts` with the cases listed in Files
   Modified, reusing the existing BLE-mock `__emitNotification` helper already used by
   this suite's sample-ingestion tests.
5. Add the new translation keys to `en.json` and `ja.json` (Files Modified above); run
   `pnpm test -- localeCoverage` (or the full suite) to confirm parity.
6. Implement `src/components/BpmReadout.tsx`: no-data branch, the reanimated pulse effect
   keyed on `bpm` changes, styling from `@/theme` only.
7. Write `src/tests/components/BpmReadout.test.tsx`: renders the numeric value when `bpm`
   is a number; renders `workout.noData` text when `bpm === null`; re-rendering with the
   same `bpm` value does not throw (reanimated's mocked driver from `jest-expo` is
   sufficient — no real animation timing is asserted, per this repo's device-only
   verification convention for anything visual/native).
8. Implement `src/components/ReconnectingBanner.tsx`: `null` when not visible, banner
   with `workout.reconnecting` copy when visible.
9. Write `src/tests/components/ReconnectingBanner.test.tsx` covering both branches.
10. Rewrite `src/app/workout.tsx` per the Interfaces / API contract: controls per
    `status`, `BpmReadout`, rolling-avg line, `ReconnectingBanner`, the stop→navigate
    effect, the `useFocusEffect`/`BackHandler`/`Alert.alert` confirm flow, and the
    status-gated `Link` back to `/`.
11. Write `src/tests/app/workout.test.tsx` with `@testing-library/react-native`, mocking
    `expo-router`'s `useRouter`/`router` (assert `router.replace` is called with
    `/summary/current` only after `stop()`), and `BackHandler.addEventListener` (capture
    the registered handler, invoke it directly to simulate a hardware back press, mock
    `Alert.alert` to assert its title/message/button copy and to invoke the destructive
    button's `onPress` to verify it calls `stop()` and reaches the same navigation).
    Cover: Start begins a session; Pause/Resume toggle the button row and freeze/resume
    the timer; Stop navigates to `/summary/current`; the reconnecting banner appears and
    disappears with the hook's `reconnecting` flag without interrupting the timer or
    disabling Stop; a simulated hardware back while `active` shows the confirm alert and
    does **not** navigate when its cancel option is chosen; choosing its confirm option
    stops the session and navigates, identically to pressing Stop; a hardware back while
    `idle` is not intercepted (default behavior, no alert).
12. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`.
13. Manual/device verification (per Acceptance Criteria — needs `pnpm android`, a real
    broadcaster or a Garmin in broadcast mode, and physically moving the device out of
    and back into range): a 5-minute session for timer accuracy and live BPM updates; a
    real disconnect/reconnect cycle for the indicator; confirming the screen stays awake
    for the whole session (already covered by `useWorkoutSession`'s existing keep-awake
    effect — this step is verifying the wiring end-to-end, not adding new keep-awake
    logic).

## Style & Conventions

- `rollingAverageBpm.ts` has zero React/native imports and takes `now` as an explicit
  parameter, matching `sessionElapsed.ts`'s established precedent and `CLAUDE.md`'s
  services-layer testing guidance.
- `useWorkoutSession.ts` gains fields, not a second hook — the issue's own "component
  talks to the store/hook, never to `bleService` directly" is satisfied by keeping every
  BLE/store read behind this one hook, exactly as the workout-session-store spec already
  established.
- `BpmReadout`/`ReconnectingBanner` are presentational, prop-only components (no hook, no
  store import) per `CLAUDE.md`'s layering contract ("`components/` never imports from
  `services/`; it goes through `hooks/`") — they don't need to, since `workout.tsx` passes
  every value down from the one hook call.
- No `fontFamily` applied anywhere in the new components/screen, per `CLAUDE.md`'s
  "fonts are pending" rule — `type.displayMetrics`/etc. are destructured for
  `fontSize`/`fontWeight`/`lineHeight` only, matching every existing screen.
- Controls stay inline `Pressable`s in `workout.tsx` rather than a new shared button
  component, matching `index.tsx`'s existing precedent for a screen-specific action row.
- Test files mirror source paths 1:1 under `src/tests/`, matching every prior spec's
  convention in this repo.
- `Alert.alert` and `BackHandler` are used directly from `react-native` — no wrapper
  hook is introduced for a single call site with no other consumer.

## Acceptance Criteria

- [ ] `getRollingAverageBpm` returns the correct mean over the 30s window, `null` when no
      sample is in-window, and never mutates its input.
- [ ] `useWorkoutSession` exposes `currentBpm` (latest sample's bpm, `null` before any
      sample this session, unaffected by `reconnecting`) and `rollingAverageBpm`
      (`getRollingAverageBpm` over `samples`), both frozen while `paused`.
- [ ] The BPM readout animates on value change and renders the no-data state when
      `currentBpm` is `null`.
- [ ] Start/Pause/Resume/Stop render the correct button set per `status` and call the
      matching `useWorkoutSession` action.
- [ ] The reconnecting indicator appears and disappears with `reconnecting` without
      pausing the elapsed timer or disabling the Stop button — the issue's "non-blocking"
      requirement, exercised in `workout.test.tsx` by asserting `elapsedMs` continues to
      change and Stop remains pressable while `reconnecting` is `true`.
- [ ] Stop calls `useWorkoutSession().stop()` and navigates to `/summary/current`.
- [ ] A hardware back press while `active`/`paused` shows a confirm alert; cancelling it
      leaves the session running and does not navigate; confirming it stops the session
      and navigates identically to Stop. A hardware back press while `idle`/`stopped` is
      not intercepted.
- [ ] Verified on a dev-client build with a real broadcaster: BPM updates live, and the
      timer is accurate over a 5-minute session (per the issue's own acceptance
      criteria — manual, device-only).
- [ ] Walking the paired device out of range shows the reconnecting indicator without
      stopping the clock; walking back in clears it (manual, device-only).
- [ ] The screen stays awake for the whole active session (manual, device-only —
      re-verifies `useWorkoutSession`'s existing keep-awake wiring end-to-end on this
      screen).
- [ ] `pnpm test` passes, including every new/modified suite, with `react-native-ble-plx`
      mocked and no real native module touched.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **Android only**, per `CLAUDE.md` — `BackHandler`'s hardware-back listener is
  Android-specific by nature (there is no iOS hardware back button); no platform branch
  is needed since this app has no iOS target.
- **`/summary/current` is a placeholder route segment, not a session id.** No
  session-history storage or per-session identifier exists anywhere in the repo yet
  (`docs/specs.md` items 3–4 — session summary screen, history screen — are both
  not-yet-filed issues). This spec's Stop/confirm-back paths navigate to a fixed literal
  segment; `src/app/summary/[id].tsx` already renders whatever id it receives today and
  needs no change to accept it. The not-yet-filed session-summary-screen issue is expected
  to replace this literal with a real persisted-session id (and to actually compute/save
  avg/max/min and write to storage) — this spec does not attempt to design that scheme
  now, per every prior spec's own pattern of not speculatively building a not-yet-filed
  issue's contract.
- **No session persistence.** Stopping a session here does not write anything to MMKV,
  Health Connect, or any store — `useWorkoutSessionStore`'s in-memory `stop()` behavior
  (frozen `stoppedElapsedMs`, retained `samples`) is unchanged and is exactly what the
  not-yet-filed persistence issue will read.
- **No avg/max/min stat reduction.** The rolling average is a live, windowed readout for
  the active session only — full-session stat reduction is explicitly the session-summary
  screen's scope (`docs/specs.md` item 3), not this one.
- **No calorie math, no MET formula.** Out of scope per `docs/specs.md`'s later
  milestones/stretch goals; this spec touches only BPM/elapsed/reconnect display.
- **`reconnecting` is read, never driven, by this screen.** `useWorkoutSession` already
  derives it from the BLE connection snapshot (`docs/specs/workout-session-store/SPEC.md`)
  — this spec's `ReconnectingBanner` is purely a rendering of that existing flag; no new
  reconnect mechanism, retry logic, or manual-reconnect action is added to this screen.
- Functional verification of real BLE drops, real elapsed-time accuracy, and real
  screen-sleep behavior needs a device and `pnpm android` (dev client) — unit/component
  tests here cover the pure rolling-average math, the hook's derived fields, and the
  screen's button/navigation/back-confirm wiring against mocks only, per `CLAUDE.md`'s
  "Expo Go does not work here" and this repo's existing BLE-mocking testing convention.
