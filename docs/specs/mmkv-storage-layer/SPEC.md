# Feature: MMKV Storage Layer with Namespaced Keys

## Intent

A single, portable `src/services/storage/` module wraps `react-native-mmkv` behind a
typed get/set/remove interface, namespaces every key `@fitness_tracker/`, and backs the
app's first real persisted value — the last-paired BLE device — with no other code aware
of MMKV as the storage engine.

## Context

- **Problem statement:** Milestone 1.5 (`docs/specs.md:44`) calls for a local store
  holding the last-paired device and session history. Nothing under `src/services/`
  persists anything today — `src/services/formatDuration.ts` is the only file in that
  directory, and there is no `src/services/storage/` path at all.
- **Current code:** GitHub issue #4 describes this as porting
  `src/services/storage/deviceStorage.ts` off `@react-native-async-storage/async-storage`.
  Neither is true of this repository: `deviceStorage.ts` does not exist, and
  `@react-native-async-storage/async-storage` is not a dependency in `package.json` and
  has zero references anywhere under `src/` (confirmed via repo-wide search). The pairing
  screen itself is still a stub (`src/app/index.tsx`) with two `Link`s and no scan/connect
  logic, no BLE device selection, and nothing that reads or writes a "last paired device."
  This spec therefore builds `deviceStorage.ts` and the MMKV wrapper from scratch; it is
  not a migration. The issue's AsyncStorage-removal acceptance criteria (no dependency, no
  call sites) are already true and this work only has to keep them true — no deletion step
  is required.
- **User impact:** None yet observable in the UI — the pairing screen doesn't read this
  value. This lays the storage seam that Milestone 1's device-pairing work (a separate,
  not-yet-started issue) will call into for auto-reconnect, and that Zustand session-state
  persistence will use per `CLAUDE.md`'s Milestone 1 tech-stack notes.
- **Dependencies:** `react-native-mmkv` is a native module — adding it requires
  `npx expo install react-native-mmkv` and a dev-client rebuild (`pnpm android`); it cannot
  be verified in Metro/Expo Go. No other pending work blocks this.

## Data Model

- `PairedDevice` (new type, `src/interfaces/`):
  ```ts
  export interface PairedDevice {
    id: string;
    name: string | null;
  }
  ```
  Matches the shape already scripted in the `react-native-ble-plx` mock
  (`__mocks__/react-native-ble-plx.ts`) and used in
  `src/tests/services/react-native-ble-plx.test.ts` (`{ id, name, rssi }`, minus `rssi`,
  which is scan-time-only signal strength and not meaningful to persist).
- No database/schema migration — MMKV is a flat key-value store. One key holds the
  serialized `PairedDevice | null`.
- Invariant: every key written through the wrapper is namespaced `@fitness_tracker/<name>`
  per `CLAUDE.md`'s storage-keys convention. The device-storage key is
  `@fitness_tracker/last-paired-device`.
- This module stores single JSON values only. Per the issue's notes and `CLAUDE.md`'s
  Milestone 3 storage plan, per-second time-series data (HR samples, GPS points) is
  explicitly out of scope here and will move to `expo-sqlite` later — the wrapper's API
  must not be shaped as if large arrays will live in it long-term.

## Interfaces / API

`src/services/storage/mmkvStorage.ts` — the generic wrapper, no app-specific knowledge:

```ts
export function getItem<T>(key: string): T | null;
export function setItem<T>(key: string, value: T): void;
export function removeItem(key: string): void;
```

- `key` passed to these three functions is expected to already include the
  `@fitness_tracker/` prefix — the prefixing responsibility lives with call sites
  (`deviceStorage.ts`, future modules), not the generic wrapper, so the wrapper stays
  reusable for any key shape.
- `getItem` reads the raw string via a single module-level `MMKV` instance, returns `null`
  if the key is absent, and `JSON.parse`s otherwise. A value that fails to parse (corrupt
  or unexpectedly shaped data) is treated as absent: catch, return `null`. This module
  never throws on read.
- `setItem` calls `JSON.stringify(value)` and writes it; `undefined` is rejected (throw) —
  `JSON.stringify(undefined)` silently produces `undefined` the string `"undefined"` would
  round-trip incorrectly, so callers must pass `null` explicitly to store "no value."
- `removeItem` deletes the key; no-op if the key doesn't exist.
- No React import. No knowledge of what "last paired device" or any other domain concept
  means — this is the same "no React, no app awareness" contract `formatDuration.ts`
  already follows and `CLAUDE.md`'s layering contract requires of everything under
  `services/`.

`src/services/storage/deviceStorage.ts` — the one app-specific call site this issue ports
into the wrapper:

```ts
export function getLastPairedDevice(): PairedDevice | null;
export function setLastPairedDevice(device: PairedDevice | null): void;
```

- Both are thin: `getLastPairedDevice` calls
  `getItem<PairedDevice>('@fitness_tracker/last-paired-device')`;
  `setLastPairedDevice(device)` calls `setItem(key, device)` when `device` is non-null and
  `removeItem(key)` when `null` (clears the stored device rather than persisting a literal
  `null`, keeping `removeItem` exercised and avoiding an ambiguous stored-null state).
- No other public surface. Nothing here decides _when_ to call these — that's the pairing
  screen's job in a future issue.

## Files Created

| File                                               | Purpose                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/storage/mmkvStorage.ts`              | Generic typed get/set/remove wrapper around one MMKV instance.                                                                        |
| `src/services/storage/deviceStorage.ts`            | Last-paired-device read/write, built on the generic wrapper.                                                                          |
| `src/interfaces/storage.ts`                        | `PairedDevice` type shared between storage and (future) pairing code.                                                                 |
| `__mocks__/react-native-mmkv.ts`                   | In-memory `MMKV` class mock, following the existing `react-native-ble-plx` mock pattern, so unit tests never touch the native module. |
| `src/tests/services/storage/mmkvStorage.test.ts`   | Unit tests for the generic wrapper (get/set/remove, missing key, corrupt JSON, `undefined` rejection).                                |
| `src/tests/services/storage/deviceStorage.test.ts` | Unit tests for the device-specific read/write, including the null-clears-key path.                                                    |

## Files Modified

| File           | Change                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` | Add `react-native-mmkv` (via `npx expo install`, pinned to the Expo-managed version). No AsyncStorage entry to remove — none exists. |

## Implementation Steps

1. Run `npx expo install react-native-mmkv`; confirm it lands in `dependencies` in
   `package.json` at the Expo-managed version.
2. Add `src/interfaces/storage.ts` with the `PairedDevice` interface.
3. Add `__mocks__/react-native-mmkv.ts`: an in-memory `Map<string, string>`-backed `MMKV`
   class exposing `getString(key)`, `set(key, value)`, `delete(key)` — matching
   `react-native-mmkv`'s real instance API — so it's a drop-in swap for tests. Register it
   the same way `__mocks__/react-native-ble-plx.ts` already is (Jest's automatic
   root-level `__mocks__` resolution — confirm no explicit `jest.mock` wiring is needed
   beyond what `jest.config.js` already does for the BLE mock).
4. Implement `src/services/storage/mmkvStorage.ts`: one module-level `MMKV` instance,
   `getItem`/`setItem`/`removeItem` per the contract above, including the corrupt-JSON
   catch-and-return-null and the `undefined`-value throw.
5. Write `src/tests/services/storage/mmkvStorage.test.ts` against the mock: round-trip a
   value, missing key returns `null`, corrupt stored string returns `null`, `removeItem`
   clears a set key, `setItem(key, undefined)` throws.
6. Implement `src/services/storage/deviceStorage.ts` on top of the wrapper.
7. Write `src/tests/services/storage/deviceStorage.test.ts`: set-then-get round-trip,
   `getLastPairedDevice()` with nothing stored returns `null`, `setLastPairedDevice(null)`
   clears a previously-stored device.
8. Confirm no other call sites need touching:
   `grep -r async-storage src/` and `grep -r "@react-native-async-storage" package.json`
   both already return nothing — re-run them after the above to confirm nothing
   regressed.
9. Run verification commands (below).

## Style & Conventions

- Follows `CLAUDE.md`'s layering contract: `services/storage/` has no React import and
  nothing from `app/`, `components/`, `hooks/`, `store/`, or `theme/`; native-module
  access (the `MMKV` instance) inside a service adapter is explicitly permitted by that
  same contract.
- `PairedDevice` lives in `src/interfaces/`, not a local `types/` file, per `CLAUDE.md`.
- Storage key namespacing (`@fitness_tracker/<name>`) is a direct `CLAUDE.md` requirement,
  not a local decision.
- Test file mirrors source path 1:1 under `src/tests/`, matching the existing
  `src/tests/services/formatDuration.test.ts` / `src/tests/services/react-native-ble-plx.test.ts`
  convention.
- Mock lives at repo-root `__mocks__/`, matching the existing `react-native-ble-plx` mock
  rather than an inline `jest.mock()` per test file.
- No abstraction beyond the two files: `mmkvStorage.ts` stays a generic 3-function wrapper
  (the seam Milestone 3's SQLite swap needs) and `deviceStorage.ts` stays the one
  domain-specific consumer this issue actually needs. Session-history storage is
  explicitly not built here — it has no consumer yet (history screen is still a stub) and
  would be speculative scope beyond this issue.

## Acceptance Criteria

- [ ] `getLastPairedDevice()` returns `null` when nothing has been stored.
- [ ] `setLastPairedDevice(device)` followed by `getLastPairedDevice()` returns an
      equivalent `PairedDevice`.
- [ ] `setLastPairedDevice(null)` removes the underlying key rather than storing a literal
      null.
- [ ] `mmkvStorage.getItem` returns `null` (not a throw) on a corrupt/non-JSON stored
      string.
- [ ] `mmkvStorage.setItem(key, undefined)` throws.
- [ ] `grep -r async-storage src/` returns nothing.
- [ ] `grep -r "@react-native-async-storage" package.json` returns nothing.
- [ ] Every key written by this module is prefixed `@fitness_tracker/`.
- [ ] `pnpm test` passes, including the new suites, with `react-native-mmkv` mocked (no
      real native module touched).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## Constraints

- Android only, per `CLAUDE.md` — no iOS-specific MMKV configuration or testing.
- MMKV is a native module: functional verification (not just mocked unit tests) requires
  `pnpm android` to rebuild the dev client; it cannot be exercised in Expo Go or plain
  Metro.
- No session-history persistence in this issue — out of scope until the history screen
  and its data shape exist.
- No Zustand-persistence wiring in this issue, even though `CLAUDE.md` names MMKV as
  Zustand's future backing store — no store exists yet to wire it into.
- Do not design `mmkvStorage.ts`'s API around arrays or time-series data surviving
  long-term; that data moves to `expo-sqlite` in Milestone 3 per the issue notes and
  `CLAUDE.md`.
- This is new code, not a migration — there is no existing `deviceStorage.ts` or
  AsyncStorage usage to delete. Treat the issue's "port" and "remove call sites" framing
  as already satisfied by the repo's current state.
