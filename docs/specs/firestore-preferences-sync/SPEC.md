# Feature: Firestore Sync of User Preferences (Units, Language)

## Intent

Units and language follow the Google-signed-in user across devices. Settings are still read
from MMKV and still change instantly offline, signed out, or as a guest; Firestore is a mirror
of one small document per Google account, reconciled on sign-in by whichever side was written
last.

## Context

- **Problem statement:** Issue #22 (M2). `@react-native-firebase/app`, `auth`, and
  `crashlytics` are installed and Google/guest sign-in ships
  (`docs/specs/firebase-google-sign-in/SPEC.md`), but `@react-native-firebase/firestore` is
  not a dependency — `grep -rn firestore src/` returns nothing. Units and language live only
  in MMKV, so a signed-in user who installs the app on a second device starts from device
  defaults. `README.md:89-90` and `docs/specs/settings-units-toggle/SPEC.md:469` both record
  this as the outstanding M2 item. No Firestore security rules exist anywhere in the repo.
- **Current code:**
  - `src/store/settingsStore.ts` — the only home of `units` / `language`. `zustand` +
    `persist` + `createJSONStorage` over `src/services/storage/mmkvStorage.ts`, key
    `@fitness_tracker/settings`. Initial values come from `getDeviceUnitSystem()` and
    `getDeviceLocale()`. `setUnits` / `setLanguage` are plain `set({...})` calls with no
    timestamp — this feature adds the one field the merge needs.
  - `src/hooks/useTranslation.ts` and `src/hooks/useUnitFormat.ts` — the only readers of the
    store's two fields. Both stay unchanged: they subscribe to the store, so a remote value
    applied to the store re-renders every screen with no extra wiring.
  - `src/store/authStore.ts` + `src/hooks/useAuthListener.ts` — `status`, `user` (`AuthUser`
    with `uid` and an optional `isAnonymous`), and the single app-lifetime
    `onAuthStateChanged` subscription mounted at the root. `user.uid` is the document id;
    `status` transitions are the sync trigger, and `isAnonymous` is what excludes guests.
  - `src/services/auth/firebaseAuth.ts` — the adapter precedent: modular
    `@react-native-firebase` imports, app-shaped return types, no React.
    `firestorePreferences.ts` follows it exactly.
  - `src/services/crashService.ts` — `reportError(error, context)`. Every native call in the
    codebase is wrapped in it; the Firestore adapter is no exception.
  - `src/services/healthConnect/pendingSessionSync.ts` — the existing "sync with retry"
    precedent, with its own `SYNC_BACKOFF_MS` table. This feature deliberately does **not**
    copy it; see Constraints.
  - `src/store/networkStore.ts` / `src/hooks/useNetworkStatus.ts` — the offline signal. Not
    consulted by the sync: Firestore's own offline queue already covers it.
  - `src/app/_layout.tsx` — where `useAuthListener()`, `useNetworkMonitor()`, and
    `useHealthConnectSyncQueue({ autoFlushOnForeground: true })` are mounted once.
    `usePreferencesSync()` joins them.
  - `app.json` — `android.googleServicesFile` is `./google-services.json` (tracked);
    `plugins` lists `@react-native-firebase/app`, `crashlytics`, and `auth`.
  - `__mocks__/@react-native-firebase/auth.ts` — the hand-written mock pattern
    (`__emit*` / `__set*Error` / `__listenerCount` / `__reset` / `__calls`), auto-applied
    because it sits in the root `__mocks__` for a `node_modules` package. The Firestore mock
    mirrors it.
  - `jest.config.js` — `jest-expo` preset, `setupFilesAfterEach` → `jest.setup.js`, `@/*`
    mapped to `src/*`.
- **User impact:** A Google user's units and language appear on any device they sign in on.
  Changing a setting is still instant and never shows a spinner or an error. Signed-out and
  guest users notice nothing different — their settings stay on the device. No new screen,
  row, or copy.
- **Dependencies:**
  - `npx expo install @react-native-firebase/firestore` — must resolve to the same major as
    the installed `@react-native-firebase/app` (`^26.2.0`).
  - Issue #21 (Firebase Auth) — shipped. Issue #18 (units toggle) — shipped.
  - Firebase console: a Cloud Firestore database created in Native mode for project
    `fitness-tracker-c785c`.
  - A new native module means a rebuild (`pnpm android`) and a new EAS fingerprint. This
    cannot ship as an OTA update.
  - No new Android permission; `INTERNET` and `ACCESS_NETWORK_STATE` are already declared.

### Facts to confirm during implementation

- **Modular API export names.** Write modular, as `crashService.ts` and `firebaseAuth.ts` do:
  `getFirestore`, `doc`, `getDoc`, `setDoc`, `onSnapshot`. Verify these exist at the package
  root of the installed `@react-native-firebase/firestore` `.d.ts` before writing the adapter —
  the sibling `auth` package dropped its `FirebaseAuthTypes` namespace at v26, so do not assume
  a `FirebaseFirestoreTypes` namespace exists either.
- **Config plugin.** `@react-native-firebase/firestore` is not expected to need an `app.json`
  `plugins` entry (only `app`, `crashlytics`, and `auth` have plugins today). Check the
  installed package for an `app.plugin.js`; add the entry only if one exists.
- **Offline persistence default.** React Native Firestore enables local persistence and
  offline write queuing by default. Confirm this on the installed version before relying on it
  for the offline acceptance criterion; if it is opt-in on v26, enable it once in the adapter
  rather than building a queue.
- **`onSnapshot` local echo.** A local `setDoc` fires the snapshot listener immediately from
  cache. The `updatedAt` guard in `usePreferencesSync` is what stops that echo from looping;
  confirm the guard holds against the installed SDK's snapshot ordering.

## Data Model

### New: `src/interfaces/preferences.ts`

```ts
// The whole synced document. One per user, no subcollections.
export interface UserPreferences {
  units: UnitSystem;
  language: LocaleCode;
  updatedAt: number; // client epoch ms, the last-write-wins key
}

// Which side of a merge won, for logging and for the write-back decision.
export type PreferenceMergeSource = 'local' | 'remote';

export interface PreferenceMergeResult {
  winner: UserPreferences;
  source: PreferenceMergeSource;
}

export const PREFERENCES_COLLECTION = 'users';
```

`updatedAt` is a plain client-written number, not `serverTimestamp()`. A server sentinel reads
back as `null` until the write is acknowledged, which makes it useless as the merge key for a
document written offline — the exact case the acceptance criteria call out. The cost is
sensitivity to device clock skew, acceptable for a single-user preference document.

### Changed: `src/store/settingsStore.ts`

`SettingsState` gains one persisted field and one action:

```ts
export interface SettingsState {
  units: UnitSystem;
  language: LocaleCode;
  updatedAt: number; // 0 until the user changes something on this device
  setUnits: (units: UnitSystem) => void;
  setLanguage: (language: LocaleCode) => void;
  applyRemoteSettings: (preferences: UserPreferences) => void; // adopts remote updatedAt verbatim
}
```

`setUnits` and `setLanguage` stamp `updatedAt: Date.now()`. `applyRemoteSettings` copies the
remote `updatedAt` instead of stamping a new one, so the two devices agree on the document's
age and an applied remote value can never win a later merge against its own origin.

`updatedAt` initialises to `0`, so a device where no setting has ever been touched always loses
to any remote document. No `persist` `version` bump or `migrate` is needed: `persist`
shallow-merges the stored `{units, language}` over the initial state, and an already-installed
app simply starts at `updatedAt: 0`. Pre-existing local choices therefore lose to a remote
document on first sign-in — accepted, since the alternative is a first-run backfill the issue
explicitly rules out.

### Firestore document

`users/{uid}` — `{ units: string, language: string, updatedAt: number }`. Flat, three fields,
no history, no subcollections.

**Guest (anonymous) sessions get no document.** An anonymous `uid` would work technically, but
the account is device-bound and discarded on sign-out, so its document would be orphaned the
moment it was written and would never reach a second device — the feature's whole point. Guests
are excluded in two places, deliberately: `usePreferencesSync` skips a user with
`isAnonymous === true`, and the security rules reject the `anonymous` sign-in provider, so a
client bug cannot start writing guest documents unnoticed.

## Interfaces / API

### `src/services/preferences/preferencesDocument.ts` (pure, no native imports)

```ts
export function preferencesPath(uid: string): string;
// `users/${uid}`; throws TypeError on an empty uid.

export function toUserPreferences(data: unknown): UserPreferences | null;
// Validates an unknown remote payload; null if units/language/updatedAt are missing or invalid.

export function mergePreferences(
  local: UserPreferences,
  remote: UserPreferences | null,
): PreferenceMergeResult;
// Higher `updatedAt` wins; a tie and a null remote both resolve to local.
```

`toUserPreferences` rejects rather than coerces: an unknown `units` or `language` string — a
value written by a newer app version, or a hand-edited document — must not reach
`SUPPORTED_UNIT_SYSTEMS` / `SUPPORTED_LOCALES` consumers. It validates against those two
exported constants so the check cannot drift from the unions.

### `src/services/preferences/firestorePreferences.ts` (native adapter, no React)

```ts
export async function readPreferences(
  uid: string,
): Promise<UserPreferences | null>;
// null for a missing, empty, or invalid document. Rejects only on a transport failure.

export async function writePreferences(
  uid: string,
  preferences: UserPreferences,
): Promise<void>;
// setDoc with { merge: true }. Offline, the SDK queues it; this resolves only on server ack.

export function subscribeToPreferences(
  uid: string,
  onChange: (preferences: UserPreferences | null) => void,
): () => void;
// Returns the unsubscribe function. Snapshot errors go to reportError, not to onChange.
```

Every function wraps its native call and reports through `reportError` with a
`{ scope: 'firestorePreferences.<fn>', uid }` context, matching `mmkvStorage.getItem`.
`subscribeToPreferences` never throws from its error path — a listener failure must not surface
as a settings change.

### `src/hooks/usePreferencesSync.ts`

```ts
export function usePreferencesSync(): void;
```

Mounted once, at the root. No return value: there is no sync UI. It acts only on a
**syncable** user — `status === 'signed-in'` **and** `user.isAnonymous !== true`. Every other
auth state, guests included, is treated exactly like signed out:

| Auth transition                                    | Action                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| → syncable (Google)                                | Read the document once, `mergePreferences` against the store, apply or push the winner, then subscribe. |
| stays syncable, store `updatedAt` rises            | Debounced (1500 ms) fire-and-forget `writePreferences`.                                                 |
| remote snapshot with a newer `updatedAt`           | `applyRemoteSettings`.                                                                                  |
| → `signed-out` / `error` / guest / a different uid | Unsubscribe, cancel any pending debounce, leave local settings untouched.                               |

The guest check sits on `isAnonymous`, not on the provider id, because that is the field
`AuthUser` already carries and the one `signInAnonymouslyFirebase` sets. `isAnonymous` is
optional on `AuthUser`, so the test is `!== true`: an absent value means a Google user.

The push guard is `syncedAt`, an effect-scoped variable holding the last `updatedAt` this
device either pushed or adopted. A write fires only when the store's `updatedAt` exceeds it,
which is what breaks the snapshot-echo loop without needing a flag inside the store. It needs
no `useRef`: nothing outside the effect reads it, and the effect is keyed on the uid.

The inbound guard is separate and compares against the store, not `syncedAt`: a snapshot is
adopted only if its `updatedAt` beats the value currently on screen. That is what makes a
stale snapshot lose to a local change still sitting inside the debounce window.

Failures are swallowed: no retry, no state, no user-visible error. A lost write is corrected by
the next preference change or the next sign-in merge. The hook does **not** call `reportError`
itself — the adapter already reported the failure with its own scope and the uid, and a second
report would only duplicate the non-fatal in Crashlytics.

### `src/utils/debounce.ts`

```ts
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void };
```

Trailing-edge only. `cancel()` exists so the hook's cleanup cannot fire a write after
sign-out. It lives in `utils/` because it is generic — the portability rule in `CLAUDE.md`.

### `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.firebase.sign_in_provider != 'anonymous';
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && request.resource.data.keys().hasOnly(['units', 'language', 'updatedAt'])
        && request.resource.data.units in ['metric', 'imperial']
        && request.resource.data.language in ['en', 'ja']
        && request.resource.data.updatedAt is number;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The catch-all deny is the important line: it stops a future collection from being
world-writable by omission. The field allow-list means a compromised client cannot grow the
document into a data store, which is the whole reason workout data is excluded. The
`sign_in_provider` check is written as `!= 'anonymous'` rather than `== 'google.com'` so that
adding a real provider later does not silently switch sync off for those users. Note that
`sign_in_provider` is the only reliable place to see anonymity server-side — the token has no
`isAnonymous` claim.

## Files Created

| File                                                          | Purpose                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/interfaces/preferences.ts`                               | `UserPreferences`, merge types, collection name.                |
| `src/services/preferences/preferencesDocument.ts`             | Pure path, validation, and merge logic.                         |
| `src/services/preferences/firestorePreferences.ts`            | Firestore read / write / subscribe adapter.                     |
| `src/hooks/usePreferencesSync.ts`                             | Ties auth state, the store, and the adapter together.           |
| `src/utils/debounce.ts`                                       | Trailing-edge debounce with `cancel`, for the write path.       |
| `firestore.rules`                                             | Committed security rules — per-user document, field allow-list. |
| `firebase.json`                                               | Points the Firebase CLI at `firestore.rules` so it deploys.     |
| `__mocks__/@react-native-firebase/firestore.ts`               | Hand-written mock with `__set*` / `__emit*` / `__reset`.        |
| `src/tests/services/preferences/preferencesDocument.test.ts`  | Merge and validation cases.                                     |
| `src/tests/services/preferences/firestorePreferences.test.ts` | Adapter behaviour and error reporting.                          |
| `src/tests/hooks/usePreferencesSync.test.tsx`                 | Sign-in merge, debounced push, echo guard, sign-out teardown.   |
| `src/tests/utils/debounce.test.ts`                            | Trailing edge, coalescing, `cancel`.                            |

## Files Modified

| File                                    | Change                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `src/store/settingsStore.ts`            | Adds `updatedAt`, stamps it in the setters, adds `applyRemoteSettings`.           |
| `src/tests/store/settingsStore.test.ts` | Covers timestamp stamping and `applyRemoteSettings`.                              |
| `src/app/_layout.tsx`                   | Mounts `usePreferencesSync()` alongside `useAuthListener()`.                      |
| `package.json` / `pnpm-lock.yaml`       | Adds `@react-native-firebase/firestore`.                                          |
| `app.json`                              | Only if the installed package ships an `app.plugin.js` (see Facts to confirm).    |
| `README.md`                             | Drops the "not yet implemented" notes (lines 89-90, 162); documents rules deploy. |

## Implementation Steps

1. `npx expo install @react-native-firebase/firestore`; confirm the resolved version's major
   matches `@react-native-firebase/app@^26`, and check the package for an `app.plugin.js`.
2. Read the installed `.d.ts` and confirm `getFirestore`, `doc`, `getDoc`, `setDoc`,
   `onSnapshot` at the package root, plus whether offline persistence is on by default.
3. Add `src/interfaces/preferences.ts`.
4. Write `src/utils/debounce.ts` and `src/tests/utils/debounce.test.ts` (fake timers).
5. Write `src/services/preferences/preferencesDocument.ts` and its test: a newer remote wins, a
   newer local wins, an equal `updatedAt` resolves to local, a `null` remote resolves to local,
   an unknown `units` or `language` is rejected, a non-numeric `updatedAt` is rejected, an empty
   `uid` throws.
6. Extend `src/store/settingsStore.ts` with `updatedAt` and `applyRemoteSettings`; update
   `src/tests/store/settingsStore.test.ts` to assert that the setters advance `updatedAt` and
   that `applyRemoteSettings` adopts the remote value verbatim.
7. Write `__mocks__/@react-native-firebase/firestore.ts`, following the `auth.ts` mock's shape:
   settable document data, settable read/write/subscribe errors, `__emitSnapshot`,
   `__listenerCount`, `__reset`, and a `__calls` log.
8. Write `src/services/preferences/firestorePreferences.ts` and its test: a valid document
   round-trips, a missing document reads as `null`, an invalid document reads as `null`, a
   transport failure reports through `reportError`, and a snapshot error neither throws nor
   invokes `onChange`.
9. Write `src/hooks/usePreferencesSync.ts` and its test, covering: a newer remote applied to the
   store on sign-in; a newer local pushed on sign-in; a store change while signed in pushed
   exactly once after the debounce window; a snapshot echoing the value this device just pushed
   causing no second write; sign-out unsubscribing (`__listenerCount() === 0`), cancelling the
   pending write, and leaving `units` / `language` in place; a store change while signed out
   causing no Firestore call at all; and a guest session (`isAnonymous: true`) neither reading,
   writing, nor subscribing — asserted on the mock's `__calls` log and `__listenerCount()`.
10. Mount `usePreferencesSync()` in `src/app/_layout.tsx`.
11. Add `firestore.rules` and `firebase.json`; create the Firestore database in the console and
    deploy with `npx firebase deploy --only firestore:rules`.
12. Update `README.md`.
13. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `pnpm android` and the manual
    two-device smoke test in Acceptance Criteria.

## Style & Conventions

- `CLAUDE.md` layering: `preferencesDocument.ts` imports nothing but `interfaces/`;
  `firestorePreferences.ts` may import the native module but no React; the hook is the only
  place `store/` and `services/` meet. Imports use `@/…`.
- `CLAUDE.md` crash-logging requirement: every Firestore call is wrapped and reports through
  `crashService.reportError`.
- Explicit-union convention: the merge result carries a discriminated `source`, not a boolean.
- Storage-key namespacing is untouched — the MMKV key stays `@fitness_tracker/settings`.
- **Deviation, stated deliberately:** the i18n and accessibility cross-cutting requirements are
  `N/A` here. This feature adds no user-facing string and no interactive element; a sync that
  announces itself is the opposite of what the issue asks for.
- **Deviation, stated deliberately:** no backoff/retry queue, unlike `pendingSessionSync.ts`.
  Firestore's own offline queue is the retry, and the issue forbids inventing a protocol on top
  of it.

## Acceptance Criteria

- [x] `@react-native-firebase/firestore` is installed at the same major as
      `@react-native-firebase/app`, added via `npx expo install`.
- [x] Signed in on two devices, changing units on device A updates device B without a restart.
- [x] Changing units and language in airplane mode, then reconnecting, pushes those values to
      Firestore, and the local values are never replaced by older remote ones.
- [x] Signed out, every setting still changes instantly and persists across an app restart,
      with no Firestore call made (asserted in `usePreferencesSync.test.tsx`).
- [x] Signed in as a guest, every setting still changes instantly and no Firestore read, write,
      or listener happens (asserted in `usePreferencesSync.test.tsx`).
- [x] Signing out leaves `units` and `language` unchanged and removes the snapshot listener.
- [x] A remote document with an unknown `units` or `language` value leaves local settings
      untouched instead of applying a bad value.
- [x] A Firestore write failure is reported through `crashService` and changes nothing on screen.
- [x] `firestore.rules` is committed, denies all access outside `users/{uid}`, restricts that
      document to its owner, rejects the `anonymous` sign-in provider, and rejects any field
      outside `units` / `language` / `updatedAt`.
- [x] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
- [x] `pnpm android` builds and launches with the new native module.

## Constraints

- **Non-goal: workout data.** Sessions stay on-device and in Health Connect. Firestore holds
  exactly three fields.
- **Non-goal: a sync protocol.** Last-write-wins on one small document is the entire design. No
  per-field timestamps, no vector clocks, no conflict UI, no backoff table.
- **Non-goal: sync UI.** No status row, badge, "synced" toast, or manual sync button, and no new
  translation keys.
- **Non-goal: user weight.** `CLAUDE.md` lists user weight as MMKV data and Health Connect as
  the source of truth for body data; it is not a synced preference.
- **Non-goal: migrating pre-existing local settings.** A device where no setting has been
  touched since this feature shipped carries `updatedAt: 0` and loses to any remote document.
- **A native rebuild is required** — this cannot go out as an OTA update, and the EAS
  fingerprint changes.
- **Rules deployment is a manual, out-of-band step.** Committing `firestore.rules` does not
  deploy it; the console default governs until `firebase deploy --only firestore:rules` runs.
  Verify the deployed rules in the console before calling the feature done.
- **Clock skew is the known weakness** of a client-written `updatedAt`. A device with a badly
  wrong clock can win merges it should lose. Accepted for a three-field preference document.
- **Non-goal: guest sync.** Guests keep their settings on the device only. A guest who later
  signs in with Google brings nothing with them: their local values simply take part in the
  normal sign-in merge, and win only if they are newer than the Google document.
- **Non-goal: deleting the remote document.** Signing out leaves `users/{uid}` in place — it is
  what makes the next sign-in on any device work. Account deletion is not in scope.
