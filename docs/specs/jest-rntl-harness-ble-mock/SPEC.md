# Feature: jest-expo + RNTL harness and react-native-ble-plx module mock

> Source: [GitHub issue #3](https://github.com/alvinyanson/fitness-tracker/issues/3) —
> `chore: jest-expo + RNTL harness and react-native-ble-plx module mock` · Milestone
> **M1 — Core BLE + local tracking**

## Intent

`pnpm test` runs a real, green test suite on a clean checkout with no device attached:
one pure-logic test proves the `jest-expo` harness resolves RN 0.85 transforms and the
`@/*` path alias, one component test proves `@testing-library/react-native` can render
an `expo-router` screen, and a scriptable `react-native-ble-plx` mock exists so the BLE
pairing/session issues that come after this one can write connect-failure and
mid-stream-disconnect tests without inventing their own fake `BleManager`.

## Context

- **Problem statement:** `jest-expo`, `jest`, `@types/jest`, and `@react-native/jest-preset`
  are already devDependencies (`package.json:20-25`, landed in commit `1588a80`, "Add
  GitHub Actions CI for lint, typecheck, and test") and `jest.config.js` already exists —
  but it is a bare `{ preset: 'jest-expo' }` with no `@/*` moduleNameMapper, and
  `package.json` has zero `"test"` files anywhere in the tree. `pnpm run test` today only
  passes because of `--passWithNoTests` (`package.json:38`) — it has never actually run a
  test. `@testing-library/react-native` is not installed. `react-native-ble-plx` is not
  installed and has no mock; every later BLE issue (scan, connect, characteristic
  notification parsing) needs one to avoid touching real hardware, per `CLAUDE.md` §
  Testing ("Mock `react-native-ble-plx` at the module boundary; never test against real
  hardware").
- **Current code:** `src/` has no `services/`, `hooks/`, `components/`, or `store/`
  directories yet (`CLAUDE.md` § Layout: "Only directories with real files are created").
  The only existing app code is four route files under `src/app/` (`index.tsx`,
  `workout.tsx`, `history.tsx`, `summary/[id].tsx`, `_layout.tsx`) and four theme token
  modules under `src/theme/`. None of it contains pure business logic yet — HR parsing and
  session stat reduction don't exist until their own M1 issues land. This issue proves the
  harness works; it does not backfill those services early.
- **User impact:** No end-user-facing change. For maintainers: `pnpm test` becomes a real
  gate (CI already invokes it — `.github/workflows/*.yml` step "Run tests" — so this issue
  is what gives that step something to actually verify), and every later BLE-touching issue
  gets a ready-made scriptable mock instead of hand-rolling one.
- **Dependencies:** None of M1's other open issues block this one. This issue is a
  prerequisite in spirit (not enforced by tooling) for any issue that adds a `services/`
  BLE adapter, since those issues will `import { BleManager } from 'react-native-ble-plx'`
  and rely on the mock this issue creates. Per `CLAUDE.md` § Native config,
  `react-native-ble-plx`'s Android permissions (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`,
  `ACCESS_FINE_LOCATION`, etc.) and `app.json` wiring are explicitly deferred to "its own
  issue with permission review" — this issue adds the package only as a `devDependency`
  for types and the Jest mock. It changes no runtime code path, no `app.json`, and
  requires no native rebuild.

## Data Model

N/A — this is test tooling and a fake in-memory BLE peripheral for tests. No persisted
data or migration is introduced. The mock's internal script state (queued scan results,
connect outcome, notification stream) lives only for the lifetime of a single test file.

## Interfaces / API

### `jest.config.js`

```js
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

The `@/*` mapping is required — every existing screen (`src/app/index.tsx:3`) imports
`@/theme`, and without it any RNTL render test for an existing screen fails module
resolution before it reaches an assertion.

### `src/services/formatDuration.ts` (new pure smoke-test target)

```ts
export function formatDuration(totalSeconds: number): string;
```

- Input: non-negative whole seconds elapsed in a session.
- Output: `mm:ss` for durations under an hour, `h:mm:ss` at or above one hour (matches the
  elapsed-time readout the live workout screen and session summary will both need —
  `docs/specs.md` session-recording scope — so this is a real, reusable utility, not a
  throwaway fixture).
- No React import, no native import — plain TypeScript per `CLAUDE.md` § Layout.
- Not wired into any screen by this issue; that happens when the live workout timer issue
  lands. This issue only adds the function and its test to prove `services/` unit tests
  run under `jest-expo` with no mocks needed.

### `__mocks__/react-native-ble-plx.ts` (manual Jest mock)

Root-level `__mocks__/` directory, adjacent to `node_modules`, so Jest applies it
automatically to every `import ... from 'react-native-ble-plx'` in the test run without
a per-test `jest.mock()` call (Jest's documented behavior for node_modules manual mocks).

```ts
export type ScriptedScanResult = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export class BleManager {
  constructor();

  // Scripting hooks — not part of the real BleManager API, test-only:
  __scanResults(results: ScriptedScanResult[]): void;
  __connectOutcome(outcome: 'success' | { error: Error }): void;
  __emitNotification(characteristicUUID: string, base64Value: string): void;
  __emitDisconnect(error?: Error): void;

  startDeviceScan(
    serviceUUIDs: string[] | null,
    options: unknown,
    listener: (error: Error | null, device: Device | null) => void,
  ): void;
  stopDeviceScan(): void;
  connectToDevice(deviceId: string): Promise<Device>;
  destroy(): void;
}

export class Device {
  id: string;
  name: string | null;
  discoverAllServicesAndCharacteristics(): Promise<Device>;
  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (
      error: Error | null,
      characteristic: Characteristic | null,
    ) => void,
  ): Subscription;
  onDisconnected(
    listener: (error: Error | null, device: Device) => void,
  ): Subscription;
}

export type Characteristic = { uuid: string; value: string | null };
export type Subscription = { remove(): void };
export enum State {
  Unknown = 'Unknown',
  PoweredOn = 'PoweredOn',
  PoweredOff = 'PoweredOff',
}
```

Behavior contract:

- `startDeviceScan` synchronously replays every result queued via `__scanResults` through
  `listener`, in order, then does nothing further until `stopDeviceScan` or another
  `__scanResults` call.
- `connectToDevice` resolves with a `Device` if `__connectOutcome('success')` (the
  default) is in effect, or rejects with the scripted `Error` if
  `__connectOutcome({ error })` was called first — this is the "connect failure" path the
  issue's acceptance criteria requires.
- `monitorCharacteristicForService` registers `listener`; `__emitNotification` invokes
  every registered listener whose `characteristicUUID` matches, with `characteristic.value`
  set to the given base64 string.
- `onDisconnected` registers `listener`; `__emitDisconnect(error?)` invokes every
  registered listener once, mid-stream, independent of whether a notification listener is
  also registered — this is the "mid-stream disconnect" path.
- Every scripting hook and mock instance resets between test files (Jest's default
  per-file module registry); no explicit `jest.resetAllMocks()` wiring is added by this
  issue since nothing else in the suite yet needs it.

### `package.json` — no `"test"` script change

The `"test": "jest --passWithNoTests"` script already exists (`package.json:38`) and CI
already calls it. `--passWithNoTests` stays: it is what lets `pnpm test` succeed on a
package subset with zero spec files, which remains true for the wider monorepo-shaped
`src/` tree even after this issue adds two files with tests.

## Files Created

| File                                                  | Purpose                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__mocks__/react-native-ble-plx.ts`                   | Scriptable fake `BleManager`/`Device` — scan results, connect outcome, notifications, disconnect.                                                       |
| `src/services/formatDuration.ts`                      | Pure duration formatter; the harness's service-layer smoke test target.                                                                                 |
| `src/services/formatDuration.test.ts`                 | Unit test for `formatDuration` — proves `jest-expo` runs plain-TS service tests.                                                                        |
| `src/app/index.test.tsx`                              | RNTL render test for the existing `PairingScreen` — proves the component-layer harness works.                                                           |
| `src/services/__tests__/react-native-ble-plx.test.ts` | Exercises the mock directly: scripted scan results, a connect failure, and a mid-stream disconnect notification path — the issue's two named scenarios. |

## Files Modified

| File             | Change                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `jest.config.js` | Add `moduleNameMapper` for `@/*` → `src/*` so any test importing through the path alias resolves.                                |
| `package.json`   | Add `devDependencies`: `@testing-library/react-native`, `react-native-ble-plx` (types + mock target only, no `app.json` change). |

No change to `CLAUDE.md`: § Testing already documents this exact strategy (mock
`react-native-ble-plx` at the module boundary, pure-logic tests need no mocks) — this
issue implements what's already written there, nothing there goes stale.

## Implementation Steps

1. **Install `@testing-library/react-native`.** `npx expo install -- --save-dev
@testing-library/react-native` (Expo-managed version resolution per `CLAUDE.md` §
   Non-negotiables).
2. **Install `react-native-ble-plx` as a devDependency only.** `pnpm add -D
react-native-ble-plx`. Do not run `npx expo install` for it — it is not wired into the
   app, has no plugin/config entry, and no native rebuild follows from a devDependency add.
   Confirm `app.json` is untouched.
3. **Wire the path alias into Jest.** Add `moduleNameMapper` to `jest.config.js` per
   Interfaces / API.
4. **Write the mock.** Create `__mocks__/react-native-ble-plx.ts` implementing the
   scripting hooks and behavior contract above.
5. **Write the mock's own test.** Create
   `src/services/__tests__/react-native-ble-plx.test.ts` covering: a scripted scan result
   reaching the `startDeviceScan` listener, a scripted connect failure rejecting
   `connectToDevice`, and a scripted mid-stream `__emitDisconnect` reaching a registered
   `onDisconnected` listener after a successful connect. This is the test that satisfies
   the issue's second acceptance criterion.
6. **Write the pure-service smoke test.** Create `src/services/formatDuration.ts` and
   `src/services/formatDuration.test.ts` (boundary cases: `0`, `59`, `60`, `3599`, `3600`).
7. **Write the component smoke test.** Create `src/app/index.test.tsx` rendering
   `PairingScreen` with RNTL's `render`, asserting the "Pairing" title and both `Link`
   labels are present via `getByText`.
8. **Verify.** Run `pnpm test` and confirm all four new test files pass with no
   `--passWithNoTests` fallback triggered (i.e., the suite actually executed tests, not
   skipped for lack of them). Run `pnpm typecheck` and `pnpm lint` to confirm the two new
   `devDependencies` and new files satisfy the existing CI gates.

## Style & Conventions

- `CLAUDE.md` § Layout: `formatDuration.ts` is plain TypeScript with no React or native
  import, living in `services/`, importable via `@/services/formatDuration` from other
  layers.
- `CLAUDE.md` § Testing: mock `react-native-ble-plx` at the module boundary; never test
  against real hardware — the mock replaces the entire package for every test, with no
  path that touches a real adapter.
- `CLAUDE.md` § Non-negotiables: `@testing-library/react-native` installed via `expo
install` (Expo-managed); `react-native-ble-plx` installed via plain `pnpm add -D`
  because a devDependency-only add for mock/type purposes is not an Expo SDK-managed
  runtime install.
- Existing code style (2-space indent, single quotes, semicolons, trailing commas) is
  enforced by the pre-commit hook from `docs/specs/lint-format-precommit-gate/SPEC.md`;
  new files are written to already conform, not reformatted after the fact.

## Acceptance Criteria

- [ ] `pnpm test` runs green on a clean checkout with no device attached, and its output
      shows 4+ test files / non-zero test count (not just `--passWithNoTests` passing on
      zero suites).
- [ ] `src/services/formatDuration.test.ts` covers `0`, `59`, `60`, `3599`, and `3600`
      seconds and passes without any mock.
- [ ] `src/app/index.test.tsx` renders `PairingScreen` and asserts on visible text via
      `@testing-library/react-native`.
- [ ] `__mocks__/react-native-ble-plx.ts` mock's own test demonstrates: a scripted scan
      result delivered to a scan listener, `connectToDevice` rejecting on a scripted
      connect failure, and a registered `onDisconnected` listener firing on a scripted
      mid-stream disconnect after a successful connect.
- [ ] `jest.config.js` resolves `@/*` imports (verified implicitly by `index.test.tsx`
      passing, since `PairingScreen` imports `@/theme`).
- [ ] `pnpm typecheck` (`tsc --noEmit`) passes with the two new devDependencies and five
      new files present.
- [ ] `pnpm lint` passes against the new files.
- [ ] `package.json` lists `@testing-library/react-native` and `react-native-ble-plx`
      under `devDependencies`; `app.json` has no diff.

## Constraints

- **No real BLE hardware in CI or locally.** Every test in this issue runs against the
  mock; no test opens a real Bluetooth adapter.
- **`react-native-ble-plx` is a devDependency only.** No `app.json` plugin entry, no
  Android permission block, no native rebuild. Wiring it into a real `services/`
  Bluetooth adapter with reviewed permissions is explicitly a separate, later issue per
  `CLAUDE.md` § Native config.
- **No HR-parsing or session-stat service is added here.** `formatDuration` is the one
  piece of real pure logic this issue introduces, chosen because it is small, genuinely
  reusable by the later workout-timer and summary screens, and sufficient to prove the
  harness — it is not a stand-in for the HR characteristic parser or stat-reduction logic
  those later issues own.
- **No Maestro / E2E work.** `CLAUDE.md` scopes Maestro to M2 manual-entry and history
  flows; out of scope here.
- **`--passWithNoTests` stays on the `test` script.** Removing it is out of scope; it does
  not weaken this issue's acceptance criteria since the criteria require an actual non-zero
  test count, not merely a non-zero exit code.
