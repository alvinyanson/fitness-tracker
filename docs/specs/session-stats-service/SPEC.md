# Feature: Session Stats Service (Duration, Avg/Max/Min HR)

## Intent

On Stop, a pure `computeSessionStats` reduces a session's raw HR sample buffer and
timing into duration, avg/max/min HR, and sample counts — well-defined `null` HR fields
for a zero-valid-sample session, garbage samples discarded by a documented rule, and no
React/native/BLE import anywhere in the module.

## Context

- **Problem statement:** [Issue #12](https://github.com/alvinyanson/fitness-tracker/issues/12)
  — `docs/specs.md:32` (Milestone 1.3): "On Stop, compute and show: total duration, avg
  HR, max HR, min HR." No reduction logic exists today — a repo-wide search for
  `computeSessionStats|SessionStats` outside this spec returns nothing.
  `workoutSessionStore.ts` accumulates the raw `HeartRateSample[]` and freezes
  `stoppedElapsedMs` on `stop()`, but nothing reduces the buffer into avg/max/min, and
  nothing filters the garbage samples the issue calls out (`bpm: 0` from a dropped
  notification, implausible spikes from a BLE glitch).
- **Current code:**
  - `src/store/workoutSessionStore.ts` — `stop()` freezes `stoppedElapsedMs` via
    `getElapsedMs(get(), now)` and leaves `pausedAt: null`, `reconnecting: false`;
    `samples` is left untouched (still the full accumulated buffer) so a
    post-stop consumer can read `{ ...snapshot }` and reduce it. `addSample` performs no
    validation — per `docs/specs/workout-session-store/SPEC.md`, sample validation was
    explicitly left to `parseHeartRateMeasurement`, which only decodes the GATT
    characteristic and does not filter `0`-bpm or spike values. This spec is therefore the
    first and only place that rule is enforced.
  - `src/services/session/sessionElapsed.ts` — pure `getElapsedMs(session, now)` already
    computes elapsed active time excluding every paused span, keyed off
    `WorkoutSessionSnapshot`'s `status`/`startedAt`/`pausedAt`/`totalPausedMs`/
    `stoppedElapsedMs`. This is the **only** duration authority in the repo; this spec
    reuses it rather than re-deriving pause-exclusion arithmetic a second time.
  - `src/services/session/rollingAverageBpm.ts` — pure `getRollingAverageBpm(samples, now,
windowMs)` is the existing precedent for HR-sample reduction style in this repo:
    null-safe return when no sample qualifies, no mutation of the input array, a plain
    `for` loop over `HeartRateSample[]`. This spec's HR reduction follows the same shape
    (single pass, null-safe, non-mutating) but reduces across the _entire_ session rather
    than a trailing time window.
  - `src/interfaces/session.ts` — `WorkoutSessionSnapshot` is the full shape
    `workoutSessionStore` holds; `stoppedElapsedMs: number | null` is only non-null once
    `status === 'stopped'`. `src/interfaces/heartRate.ts` — `HeartRateSample { bpm,
sensorContact, energyExpended?, rrIntervals?, timestamp }`; `bpm` and `timestamp` are
    the two fields this spec's filter and reduction touch.
  - No screen consumes this yet. The not-yet-filed session-summary screen
    (`docs/specs.md:32`'s "On Stop, compute and show") and the not-yet-filed
    session-history persistence issue (`CLAUDE.md`'s "Sessions save locally the moment the
    user hits Stop") are both separate, later work; this spec ships the reduction function
    only.
  - `docs/specs.md:84` (Milestone 3) — the calorie formula
    (`MET × weight(kg) × duration(hours)`, HR-adjusted when samples exist) will consume
    this same `SessionStats` shape plus a user weight. Issue #12's note ("keep the shape
    open to that") is satisfied by leaving `SessionStats` an object further fields can be
    added to, not by adding any M3 field now.
- **User impact:** No UI changes. This ships the pure computation the not-yet-filed
  summary screen will call after `stop()`.
- **Dependencies:** Depends on #10 (`docs/specs/workout-session-store/SPEC.md`, merged)
  for `WorkoutSessionSnapshot` and `getElapsedMs`. No new package.

## Data Model

New addition to `src/interfaces/session.ts`:

```ts
/** Pure reduction of a session's timing + HR samples. */
export interface SessionStats {
  /** Elapsed active ms, excluding paused spans. */
  durationMs: number;
  /** Rounded mean bpm; null if no valid samples. */
  avgHr: number | null;
  /** Highest valid bpm; null if none. */
  maxHr: number | null;
  /** Lowest valid bpm; null if none. */
  minHr: number | null;
  /** Samples that passed the plausibility filter. */
  sampleCount: number;
  /** Buffer length before filtering. */
  rawSampleCount: number;
}
```

`SessionStats` is a plain data object with no methods, matching `WorkoutSessionSnapshot`'s
own style. Milestone 3's calorie math is expected to take a `SessionStats` plus a user
weight as separate arguments (`computeCalories(stats, weightKg)`), not to gain a new field
on this interface — `durationMs`, `avgHr`, and `sampleCount` (for the "no HR at all falls
back to pure MET" branch, `docs/specs.md:109`) are exactly the inputs that formula needs
from this reduction. No field is added speculatively ahead of that issue.

## Interfaces / API

### `src/services/session/sessionStats.ts` (pure, dependency-free)

```ts
import type {
  WorkoutSessionSnapshot,
  SessionStats,
} from '@/interfaces/session';

/** Below this, a sample is a dropped/garbage notification. */
export const MIN_PLAUSIBLE_BPM = 30;
/** Above this, a sample is a BLE-glitch spike. */
export const MAX_PLAUSIBLE_BPM = 220;

/** Reduces a session's samples + timing into duration/avg/max/min HR. */
export function computeSessionStats(
  session: WorkoutSessionSnapshot,
  now: number = Date.now(),
): SessionStats;
```

- **Signature decision:** `timing` from the issue's `computeSessionStats(samples, timing)`
  sketch is the `WorkoutSessionSnapshot` itself, not a narrower slice. The snapshot already
  carries both `samples` and every field `getElapsedMs` needs
  (`status`/`startedAt`/`pausedAt`/`totalPausedMs`/`stoppedElapsedMs`); splitting it into
  two parameters would force every caller to destructure the same object twice for no
  benefit, and the store's `stop()`/summary-screen call sites already have the full
  snapshot in hand (`get()` / the store's public state). Delegates duration entirely to
  `getElapsedMs(session, now)` — no pause-exclusion arithmetic is duplicated here.
- **Garbage-sample-discard rule** (documented as a one-line comment at each constant, per
  this repo's brief-inline-comment convention): a sample is discarded from the HR
  reduction (but still counted in `rawSampleCount`) when `bpm <= 0` (a dropped/garbage
  GATT notification — the store's `addSample` performs no such filtering per
  `docs/specs/workout-session-store/SPEC.md`) or `bpm` falls outside
  `[MIN_PLAUSIBLE_BPM, MAX_PLAUSIBLE_BPM]` (30–220 bpm: below resting HR for a healthy
  adult even asleep, above documented maximum HR at extreme exertion — a value outside
  that band is a BLE-glitch spike, not a real reading worth including in avg/max/min).
  `sensorContact`, `energyExpended`, and `rrIntervals` are not consulted by the filter —
  out of scope for this issue, and `sensorContact` reflects strap contact at
  notification time, not sample validity.
- **Zero-valid-sample behavior:** when every sample is discarded (or `samples` is empty),
  `avgHr`/`maxHr`/`minHr` are all `null` (never `NaN`/`Infinity`) and `sampleCount` is `0`.
  `durationMs` is still computed — HR is optional per session by design
  (`CLAUDE.md`'s domain conventions), so an HR-less session still reports a valid
  duration.
- **Single-sample behavior:** `avgHr === maxHr === minHr === that sample's bpm`, rounded
  the same way `getRollingAverageBpm` rounds (`Math.round`).
- **Pause / disconnect-gap behavior:** neither is special-cased inside this function.
  A paused span already has zero samples in the buffer (per `workoutSessionStore.ts`'s
  `addSample` gate: appends only `while active`) and is excluded from `durationMs` via
  `getElapsedMs`. A disconnect-during-active gap also produces zero samples for its
  span (no notifications arrive), but stays _inside_ `durationMs` — per
  `docs/specs/workout-session-store/SPEC.md`, "the elapsed timer running... unaffected by
  reconnecting" is a hard constraint, so a long disconnect lowers `sampleCount` without
  shortening `durationMs`. This function does not detect or report a "gap" as its own
  concept — the two existing precedents (`WorkoutSessionSnapshot`'s pause bookkeeping,
  and "reconnect never touches timing") already give the correct duration behavior for
  free; a session-with-a-disconnect-gap test in this spec is verifying that composition,
  not adding new logic.
- **Does not mutate `session.samples`.**

## Files Created

| File                                              | Purpose                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/services/session/sessionStats.ts`            | Pure `computeSessionStats` + `MIN_PLAUSIBLE_BPM`/`MAX_PLAUSIBLE_BPM`, no React/native imports.                  |
| `src/tests/services/session/sessionStats.test.ts` | Unit tests: normal session, empty samples, single sample, long pause, disconnect gap, garbage-sample filtering. |

## Files Modified

| File                        | Change                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| `src/interfaces/session.ts` | Add the `SessionStats` interface alongside `WorkoutSessionSnapshot`. |

## Implementation Steps

1. Add `SessionStats` to `src/interfaces/session.ts` per the Data Model above.
2. Implement `src/services/session/sessionStats.ts`: `MIN_PLAUSIBLE_BPM`/
   `MAX_PLAUSIBLE_BPM` constants, a single-pass filter+reduce over `session.samples`
   (track sum/count/max/min while iterating, matching `getRollingAverageBpm`'s existing
   loop style rather than chaining multiple array methods), `durationMs` via
   `getElapsedMs(session, now)`.
3. Write `src/tests/services/session/sessionStats.test.ts` (no mocks, mirroring
   `sessionElapsed.test.ts`/`rollingAverageBpm.test.ts`'s `describe`/`it` + small
   `createSample`/`createSession` helper style):
   - Normal session: several valid samples plus a `stoppedElapsedMs` → correct
     `durationMs`/`avgHr`/`maxHr`/`minHr`/`sampleCount`/`rawSampleCount`.
   - Empty sample array → `avgHr`/`maxHr`/`minHr` all `null`, `sampleCount: 0`,
     `durationMs` still computed from `stoppedElapsedMs`.
   - Single sample → `avgHr === maxHr === minHr` equal to that sample's bpm.
   - Session with a long pause → construct a snapshot with `totalPausedMs` covering the
     pause and confirm `durationMs` excludes it, independent of `sampleCount` (no samples
     exist for the paused span in `session.samples` since `addSample` never appended
     during it).
   - Session with a disconnect gap → samples with a timestamp gap mid-session (simulating
     the reconnect window) but `totalPausedMs` unaffected → `durationMs` unchanged,
     `sampleCount` reflects only the samples that arrived, confirming the gap shortens
     sample density, not duration.
   - Garbage filtering → a mix including `bpm: 0` and a spike (e.g. `bpm: 250`) alongside
     valid samples → both excluded from `avgHr`/`maxHr`/`minHr` and from `sampleCount`,
     but present in `rawSampleCount`.
   - All-garbage buffer → non-empty `samples`, zero pass the filter → same `null`/`0`
     result as the empty-array case, `rawSampleCount` still reflects the discarded count.
   - Does-not-mutate assertion on the input `samples` array, matching
     `rollingAverageBpm.test.ts`'s existing convention.
4. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Style & Conventions

- Zero React/native/`ble-plx` imports in `sessionStats.ts`, per `CLAUDE.md`'s
  `services/` layering rule and the issue's own acceptance criterion — verified by the
  same "no such import" grep this repo's other `services/session/*` specs rely on.
- Reuses `getElapsedMs` rather than re-deriving pause-exclusion arithmetic, per
  `CLAUDE.md`'s "Build for portability" and this repo's existing precedent of one
  authority per computation (`sessionElapsed.ts` already owns duration).
- Single-pass loop over `samples`, non-mutating, null-safe returns — matches
  `getRollingAverageBpm`'s established reduction style in the same directory.
- `MIN_PLAUSIBLE_BPM`/`MAX_PLAUSIBLE_BPM` exported as named constants (not inlined
  magic numbers) so a future screen or the M3 calorie module can reference the same
  bounds, mirroring `ROLLING_AVERAGE_WINDOW_MS`'s existing export style.
- One-line comments only in code, rationale lives in this SPEC's prose, per this
  project's established comment-density convention.
- Test file mirrors the source path 1:1 under `src/tests/`, matching every prior spec's
  convention in this repo.

## Acceptance Criteria

- [ ] `computeSessionStats` returns `durationMs`/`avgHr`/`maxHr`/`minHr`/`sampleCount`/
      `rawSampleCount` for a normal session with valid samples.
- [ ] Empty `samples` array returns `avgHr`/`maxHr`/`minHr: null` and `sampleCount: 0`,
      never `NaN`/`Infinity`, while `durationMs` is still correctly computed.
- [ ] A single valid sample yields `avgHr === maxHr === minHr` equal to its bpm.
- [ ] A session with a long pause reports a `durationMs` that excludes the paused span.
- [ ] A session with a disconnect gap reports full active `durationMs` (unaffected by the
      gap) alongside a lower `sampleCount` for the span with no notifications.
- [ ] `bpm: 0` and implausible-spike samples (outside `[MIN_PLAUSIBLE_BPM,
MAX_PLAUSIBLE_BPM]`) are excluded from `avgHr`/`maxHr`/`minHr`/`sampleCount` but
      counted in `rawSampleCount`.
- [ ] `pnpm test` passes, including every new case above, with no mocks.
- [ ] `sessionStats.ts` imports nothing from `react`, `react-native`, or
      `react-native-ble-plx`.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- **No calorie math in this issue.** MET/HR-adjusted calorie estimation is explicitly
  Milestone 3 (`docs/specs.md:84`, issue #12's own note) — this spec only shapes
  `SessionStats` so that later work can extend it without a breaking change; it does not
  add a `calories` field or a weight parameter now.
- **No screen or persistence.** The not-yet-filed session-summary screen and
  session-history storage issue both consume `SessionStats`; neither is built here.
- **No new sample-validation at the store layer.** `workoutSessionStore.ts`'s
  `addSample` continues to accept every decoded sample unfiltered, per
  `docs/specs/workout-session-store/SPEC.md`'s explicit choice to leave validation to the
  BLE-parsing layer and (now) this reduction layer — this spec does not change
  `addSample` or `parseHeartRateMeasurement`.
- **Plausibility bounds are a documented heuristic, not a medical claim.** 30–220 bpm is
  chosen to reject obvious GATT/BLE garbage, not to model any individual's real
  physiological range; it is not configurable by user profile in this issue.
- **`now` is only meaningful for a non-`stopped` session.** Per `getElapsedMs`'s own
  contract, a `stopped` session's `durationMs` always comes from `stoppedElapsedMs` and
  ignores the `now` argument — this spec does not change that contract, only forwards to
  it.
