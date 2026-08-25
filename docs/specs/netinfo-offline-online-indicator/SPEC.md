# Feature: NetInfo Offline/Online Indicator

## Intent

The app knows whether the internet is actually reachable — not merely whether an interface
exists — keeps that in one small store, and shows an animated offline banner on the one
screen where connectivity matters today (Settings). Workout recording is untouched.

## Context

- **Problem statement:** Issue #20. Nothing under `src/` references NetInfo today (verified
  by grep: the only hits are the two Health Connect specs explicitly declining it, plus
  `docs/specs.md:54`). The package is not in `package.json`. There is therefore no way for
  any screen to know the device is offline. Milestone 2's login + Firestore preference sync
  are the first real network callers and are not implemented yet — `src/interfaces/auth.ts`
  holds only `AuthUser`, and neither `@react-native-firebase/auth` nor `firestore` is a
  dependency (only `app` and `crashlytics`). The indicator lands before them, not after.
- **Current code:**
  - `src/components/ReconnectingBanner.tsx` — the existing banner precedent: a
    `{ visible }` prop, `pointerEvents="none"`, `accessibilityRole="alert"` +
    `accessibilityLiveRegion="assertive"`, built from `@/theme` tokens. `OfflineBanner`
    follows this shape rather than inventing a second banner style.
  - `src/hooks/useHealthConnectSyncQueue.ts` — the precedent for a hook holding a
    process-wide native subscription: an `AppState` listener created in an effect and removed
    on cleanup, with the state itself in a zustand store
    (`src/store/healthConnectSyncStore.ts`). `useNetworkMonitor` follows it.
  - `src/store/settingsStore.ts`, `src/store/healthConnectSyncStore.ts` — the store naming
    convention: file named for the domain, export prefixed `use…Store`.
  - `src/app/_layout.tsx` — `GestureHandlerRootView` + `Stack`, the global `ErrorUtils`
    handler, and already the single mount point for one app-lifetime subscription
    (`useHealthConnectSyncQueue({ autoFlushOnForeground: true })`). `useNetworkMonitor()`
    joins it there.
  - `src/app/(tabs)/settings.tsx` — `HeaderBar` plus a `ScrollView` of
    `View style={styles.section}` blocks (units, language, `HealthConnectStatusCard`,
    `HealthConnectSyncQueueCard`). It has no network-dependent control today:
    `HealthConnectSyncQueueCard`'s "Sync Now" writes to the on-device Health Connect store
    and must **not** be gated on connectivity.
  - `src/services/crashService.ts` — `reportError`, `logBreadcrumb`. The `addEventListener`
    registration routes failures here, per the cross-cutting requirement in `CLAUDE.md`.
  - `src/services/i18n/translations/{en,ja}.json` — flat namespaces (`permissions`,
    `pairing`, `settings`, `healthConnect`, `common`, `units`); a `network` namespace is
    added to both.
  - `__mocks__/react-native-mmkv.ts`, `__mocks__/react-native-health-connect.ts` — the
    repo's manual-mock convention: a hand-written `__mocks__/<module>.ts` with `__set*` /
    `__reset*` helpers, auto-resolved by `jest-expo` for node_modules packages.
    `__mocks__/@react-native-community/netinfo.ts` follows it.
  - `react-native-reanimated` 4.3.1 is already a dependency, so the banner's height/opacity
    transition needs no new package.
  - `app.json` — `android.permissions` lists the five BLE permissions plus four Health
    Connect ones; no `ACCESS_NETWORK_STATE`.
- **User impact:** On Settings, toggling airplane mode slides an "You're offline" bar in or
  out within a second or two. Local preference changes (units, language) keep working
  offline, unchanged. Workout recording, BLE pairing, history and Health Connect sync are
  unaffected — none of them read the network store.
- **Dependencies:** `@react-native-community/netinfo`, installed with
  `npx expo install @react-native-community/netinfo` so the SDK 56-compatible version is
  pinned (do not hand-pick a version). It is autolinked — no Expo config plugin — but
  `ACCESS_NETWORK_STATE` is added to `app.json` per the `CLAUDE.md` native-config rule, so a
  native rebuild (`pnpm android`) is required. No migration, no storage change, no Firebase
  dependency.

### Facts to confirm during implementation

- The `NetInfoState` fields used here (`isConnected: boolean`,
  `isInternetReachable: boolean | null`) and `addEventListener(listener)` returning an
  unsubscribe function are the documented v11 API. Re-check the installed package's `.d.ts`
  before writing the mapper — the mapper is the only place that touches the shape.
- `NetInfo.configure(...)` is deliberately **not** called. The library's default reachability
  probe is sufficient; a custom `reachabilityUrl` would mean picking a third-party endpoint,
  which is out of scope.

## Data Model

### New: `src/interfaces/network.ts`

```ts
/** Three states, per the project's explicit-union convention. */
export type NetworkStatus = 'unknown' | 'online' | 'offline';

export interface NetworkReachability {
  /** `NetInfoState.isConnected` — an interface exists. */
  isConnected: boolean;
  /** `NetInfoState.isInternetReachable` — `null` while the probe is in flight. */
  isInternetReachable: boolean | null;
}
```

`'unknown'` is a first-class state, not a stand-in for online. It covers the window before
the first NetInfo event and the case where an interface is up but the reachability probe has
not answered. Only `'offline'` shows the banner, so `'unknown'` cannot cause a flash of
offline on cold start — which is what an optimistic `isConnected: true` default would
otherwise be needed for.

No persistence. Connectivity is ephemeral; nothing is written to MMKV and
`SESSION_SCHEMA_VERSION` is untouched.

## Interfaces / API

### `src/services/network/networkStatus.ts` (pure — no React, no native import)

```ts
/** Maps a NetInfo snapshot to a status. Reachability wins over interface presence. */
export function toNetworkStatus(state: NetworkReachability): NetworkStatus;
```

Mapping, total over the input space:

| `isConnected` | `isInternetReachable` | result      |
| ------------- | --------------------- | ----------- |
| `false`       | any                   | `'offline'` |
| `true`        | `false`               | `'offline'` |
| `true`        | `null`                | `'unknown'` |
| `true`        | `true`                | `'online'`  |

`isConnected: true` with `isInternetReachable: false` is the captive-portal / no-route case
the issue's "reachability, not just has an interface" bullet is about.

### `src/store/networkStore.ts`

```ts
export interface NetworkState {
  status: NetworkStatus;
  setStatus: (status: NetworkStatus) => void;
}

export const useNetworkStore: UseBoundStore<StoreApi<NetworkState>>;
```

A value and its setter, nothing more — no pre-debounce mirror, no reset, no timer. The monitor
writes straight through to it, so the store stays trivially readable and testable.

### `src/hooks/useNetworkMonitor.ts` — the side effect

```ts
/** Subscribes to NetInfo for the app's lifetime. Mounted once, at the app root. */
export function useNetworkMonitor(): void;
```

Returns nothing; it exists only for its subscription. One effect, mounted once:

1. Registers `addEventListener` from `@react-native-community/netinfo`, wrapped so a throw
   reports through `reportError` and leaves the status at `'unknown'`.
2. Maps each state through `toNetworkStatus`.
3. Writes every mapped value straight to the store via `setStatus`. No timer, no queue, no
   first-event special case — the status always reflects the last event NetInfo sent, and a
   cold start leaves `'unknown'` the moment NetInfo speaks.
4. Cleanup unsubscribes.

The listener is the hook's only moving part. See the flapping non-goal under Constraints for
what this deliberately does not do.

Splitting the subscription out of the reader is what removes the earlier `subscribe?: boolean`
flag: a hook that takes no arguments cannot be called wrongly. `useNetworkMonitor` is mounted
in `src/app/_layout.tsx` only; nothing else calls it.

### `src/hooks/useNetworkStatus.ts` — the reader

```ts
export function useNetworkStatus(): {
  status: NetworkStatus;
  isOffline: boolean; // status === 'offline'
  isOnline: boolean; // status === 'online'
};
```

A pure store read with no parameters and no effect. Any number of screens may call it, in any
order, with no coordination. The booleans are derived here rather than stored, so there is one
source of truth.

### `src/components/OfflineBanner.tsx`

```ts
export interface OfflineBannerProps {
  visible: boolean;
}
```

A full-width bar that animates its height and opacity with `react-native-reanimated`
(`useAnimatedStyle` + `withTiming`, ~300 ms, `overflow: 'hidden'`) so it slides in and out
rather than popping. It stays mounted at zero height when `!visible`, which is what makes the
transition possible. Colors and radii come from `@/theme` (`colors.errorContainer` /
`colors.onErrorContainer`), text from `t('network.offlineBannerTitle')`, plus
`pointerEvents="none"`, `accessibilityRole="alert"`, `accessibilityLiveRegion="assertive"` and
a matching `accessibilityLabel`. Callers pass `status === 'offline'`, so `'unknown'` never
shows it.

It takes a prop rather than reading the store itself, matching `ReconnectingBanner` and
`HealthConnectSyncQueueCard` — screens wire hooks, components stay presentational.

### i18n keys (added to `en.json` and `ja.json`)

```json
"network": {
  "offlineBannerTitle": "You're offline"
}
```

One key. Copy for disabled network actions belongs to whichever issue adds the first such
action.

## Files Created

| File                                               | Purpose                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `src/interfaces/network.ts`                        | `NetworkStatus` union and `NetworkReachability` snapshot shape.       |
| `src/services/network/networkStatus.ts`            | Pure `toNetworkStatus` mapper. No React, no native import.            |
| `src/store/networkStore.ts`                        | Zustand store: `status` + `setStatus`.                                |
| `src/hooks/useNetworkMonitor.ts`                   | The NetInfo subscription; mounted once at the app root.               |
| `src/hooks/useNetworkStatus.ts`                    | Parameterless store reader — `status`, `isOnline`, `isOffline`.       |
| `src/components/OfflineBanner.tsx`                 | The animated offline bar.                                             |
| `__mocks__/@react-native-community/netinfo.ts`     | Manual mock with `__setState`, `__emit`, `__reset` helpers.           |
| `src/tests/services/network/networkStatus.test.ts` | Mapper truth table, including the `null` reachability case.           |
| `src/tests/store/networkStore.test.ts`             | Default status and `setStatus`.                                       |
| `src/tests/hooks/useNetworkMonitor.test.tsx`       | Write-through on each event, unsubscribe, throwing path.              |
| `src/tests/hooks/useNetworkStatus.test.tsx`        | Derived flags across the three statuses; no subscription side effect. |
| `src/tests/components/OfflineBanner.test.tsx`      | Visible/hidden, a11y role and live region.                            |

## Files Modified

| File                                     | Change                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `package.json` / `pnpm-lock.yaml`        | Adds `@react-native-community/netinfo` via `npx expo install`.                                          |
| `app.json`                               | Adds `android.permission.ACCESS_NETWORK_STATE` to `android.permissions`.                                |
| `src/app/_layout.tsx`                    | Calls `useNetworkMonitor()` once, so the subscription's lifetime is the app's.                          |
| `src/app/(tabs)/settings.tsx`            | Reads `useNetworkStatus()` and renders `<OfflineBanner visible={isOffline} />` above the first section. |
| `src/services/i18n/translations/en.json` | Adds the `network` namespace.                                                                           |
| `src/services/i18n/translations/ja.json` | Adds the `network` namespace, translated.                                                               |
| `src/tests/app/settings.test.tsx`        | Asserts the banner is shown when the store is offline and hidden when online or unknown.                |
| `jest.setup.js`                          | Only if the manual mock needs an explicit `jest.mock` registration; prefer letting `__mocks__` resolve. |

## Implementation Steps

1. `npx expo install @react-native-community/netinfo`, add
   `android.permission.ACCESS_NETWORK_STATE` to `app.json`, rebuild with `pnpm android`.
2. Add `src/interfaces/network.ts`.
3. Add `src/services/network/networkStatus.ts` with `toNetworkStatus`; write
   `networkStatus.test.ts` covering all four rows of the mapping table.
4. Add `src/store/networkStore.ts` (`status` defaulting to `'unknown'`, `setStatus`) and its
   test.
5. Write `__mocks__/@react-native-community/netinfo.ts` exposing `addEventListener` (records
   listeners, returns an unsubscribe), plus `__setState`, `__emit` and `__reset`.
6. Add `src/hooks/useNetworkMonitor.ts`; write `useNetworkMonitor.test.tsx` for: each emitted
   state landing in the store immediately; the `null`-reachability state mapping to
   `'unknown'`; exactly one listener registered and removed on unmount; a throwing
   `addEventListener` leaving the status `'unknown'` and reporting once.
7. Add `src/hooks/useNetworkStatus.ts` and its test, asserting it registers no NetInfo
   listener.
8. Add `src/components/OfflineBanner.tsx` and its test.
9. Add the `network` namespace to `en.json` and `ja.json`.
10. Wire `useNetworkMonitor()` into `src/app/_layout.tsx` and the banner into
    `src/app/(tabs)/settings.tsx`; extend `src/tests/app/settings.test.tsx`.
11. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then on device — open Settings, toggle
    airplane mode on and off, confirm the bar slides in and out within a second or two, and
    confirm a session started before the toggle keeps recording and saves.

## Style & Conventions

- `CLAUDE.md` layering: `services/network/` is React-free and native-free (the mapper is
  pure); the NetInfo import lives in `hooks/useNetworkMonitor.ts`, matching the precedent that
  a hook may hold a native subscription while the service stays portable. `OfflineBanner`
  takes props and never reads the store, per "`components/` never imports from `services/`".
- **Monitor/reader split, no options object.** The subscription is `useNetworkMonitor()` and
  the read is `useNetworkStatus()`; neither takes a parameter, so no call site can subscribe
  by accident or forget to. A single hook carrying a `subscribe?: boolean` flag was rejected:
  it makes correctness a convention enforced by a doc comment rather than by the signature.
- **Keep it small.** The store is a value and a setter; the monitor is a listener that writes
  through to it and holds no state at all. No `rawStatus` mirror, no `reset` action, no
  debounce timer, no ref-counted subscription manager — each was considered and dropped as
  machinery without a caller.
- Explicit-union convention: `NetworkStatus` is a union, never a pair of booleans, so there is
  no `boolean | null` third state to interpret at each call site.
- Cross-cutting requirements: a11y (`accessibilityRole="alert"` + live region), i18n (both
  translation files, no literal user-facing strings), and crash logging (`reportError` around
  the `addEventListener` registration) are all covered.
- Theme tokens only — no hardcoded hex, radius or font size; `fontFamily` stays unset per the
  pending-fonts rule.

## Acceptance Criteria

- [ ] `toNetworkStatus` returns `'offline'` for a disconnected interface **and** for a
      connected interface with `isInternetReachable === false`, and `'unknown'` for `null`.
- [ ] Every state NetInfo emits lands in the store immediately — no delay, no queue, so the
      status always equals the mapping of the last event.
- [ ] `useNetworkMonitor()` registers exactly one NetInfo listener and removes it on unmount; a
      throwing `addEventListener` leaves the status `'unknown'` and calls `reportError` once.
- [ ] `useNetworkStatus()` takes no parameters and registers no NetInfo listener — mounting it
      without the monitor yields `'unknown'` and no crash.
- [ ] `OfflineBanner` is hidden (zero height, zero opacity) when `visible` is false; when
      visible it exposes `accessibilityRole="alert"` and an `accessibilityLiveRegion` of
      `assertive`.
- [ ] Settings shows the banner when the store status is `'offline'` and not when it is
      `'online'` or `'unknown'`.
- [ ] `en.json` and `ja.json` both contain every `network.*` key.
- [ ] No BLE, session or Health Connect module imports the network store — verified by grep.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass.
- [ ] On device: airplane mode on/off slides the Settings banner in and out within ~1 s, and an
      in-progress workout session keeps recording and saves normally throughout.

## Constraints

- **Non-goal: gating anything that exists today.** Health Connect sync ("Sync Now"), BLE
  pairing, session recording, history and the units/language toggles are local and stay
  unconditional. Local session recording must never depend on connectivity (issue Notes).
- **Non-goal: a network guard for network-dependent actions.** The issue's "degrade
  gracefully" bullet has no subject yet — there is not one network call in the app. Whichever
  issue adds sign-in or cloud settings sync disables its own control from
  `useNetworkStatus().isOffline` and owns the copy for it; shipping an unused
  `useNetworkGuard` here would be guessing at that call site's shape.
- **Non-goal: an offline cache or request queue.** `docs/specs.md:54` pairs the indicator with
  a "local cache", but MMKV already holds every preference locally and Health Connect is the
  offline-first path for session data. No new cache is introduced.
- **Non-goal: a global always-mounted banner.** Per the issue, the banner shows only on
  screens where connectivity matters; Settings is the only such screen until login lands. Only
  the subscription is global. A global mount in `_layout.tsx` was considered and rejected
  because it would also cover the live workout screen, where connectivity is irrelevant and
  `ReconnectingBanner` (BLE) may already be showing — two similar status bars about unrelated
  things.
- **The Settings banner is informational in this change.** Nothing on that screen is
  network-dependent yet: units and language are MMKV, and both Health Connect cards are
  on-device. The banner is mounted there because Firestore preference sync will live on that
  screen, and it is what makes the issue's airplane-mode criterion demoable. The sign-in
  screen mounts the same component the same way when the login issue lands — no change to
  this feature is required for that.
- **Non-goal: debouncing a flapping connection.** The monitor writes every NetInfo event
  straight through, so a connection that flaps produces one banner transition per event. An
  800 ms debounce was implemented and then removed deliberately: it cost a timer, a cancel
  path, a cold-start special case and three tests, and the banner's own ~300 ms height and
  opacity transition already absorbs short bursts. This is a knowing partial answer to the
  issue's flapping-connection bullet — if real-device use shows visible strobing on a radio
  hand-off, the debounce belongs in `useNetworkMonitor` and nowhere else, and the store and
  banner need no change to accommodate it.
- **Non-goal: retry-on-reconnect.** Nothing subscribes to an online transition to replay a
  failed request in this change.
- **Non-goal: TanStack Query's `onlineManager`.** The weather app wired NetInfo into it, but
  TanStack Query is an M3 dependency and is not installed.
- **Non-goal: a custom reachability endpoint.** `NetInfo.configure` is left at its defaults.
- Android only; no iOS branch. Adding `ACCESS_NETWORK_STATE` to `app.json` means this cannot
  ship as a Metro reload — it needs a native rebuild, which also moves the EAS fingerprint.
- Unresolved external fact: the exact `@react-native-community/netinfo` version
  `npx expo install` selects for SDK 56, and therefore the precise `NetInfoState` typing.
  Confirm against the installed `.d.ts` before finalizing `toNetworkStatus`.
