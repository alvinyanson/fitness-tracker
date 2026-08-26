# Feature: Firebase App + Google Sign-In Authentication

## Intent

A user can sign in with their Google account **or continue as a guest**, stay signed in across
app restarts, sign out again, and use every existing flow — pairing, recording, history,
Health Connect sync, units, language — exactly the same whether signed in or out. Auth is an
identity the app holds, never a gate it puts in front of anything.

The guest path exists for users who want an identity without handing over a Google account.
It is a real Firebase session — a `uid`, persisted natively, surviving restarts — with
`isAnonymous: true` and no profile fields. It requires no Play Services and no web client id.

## Context

- **Problem statement:** Issue #21. `@react-native-firebase/app` is already a dependency and
  its config plugin is registered in `app.json`, but only Crashlytics uses it. There is no
  authentication anywhere: grep for `auth` under `src/` returns `src/interfaces/auth.ts` (a
  two-field `AuthUser` written for `setCrashUser`) and nothing else. Neither
  `@react-native-firebase/auth` nor `@react-native-google-signin/google-signin` is installed.
  The Settings mockup (`docs/ui-reference/settings.png`) leads with an **ACCOUNT** section —
  avatar, display name, "Profile Information", "Log Out" — and the shipped
  `src/app/(tabs)/settings.tsx` has no such section at all.
- **Current code:**
  - `src/interfaces/auth.ts` — `AuthUser { uid: string; isAnonymous?: boolean }`. Consumed
    only by `setCrashUser` in `src/services/crashService.ts`, which is never called today.
    This feature is the first real producer of an `AuthUser`, and widens the interface.
  - `src/services/crashService.ts` — `getCrashlytics()` from
    `@react-native-firebase/crashlytics`, every call already wrapped in `try/catch` so an
    uninitialized Firebase in tests is a no-op. The auth adapters follow the same shape.
    `setCrashUser(user)` exists and returns early on `null`; the auth listener is its caller.
  - `app.json` — `plugins` already lists `@react-native-firebase/app` and
    `@react-native-firebase/crashlytics`; `android.googleServicesFile` is
    `./google-services.json`; `android.package` is
    `com.arcanys.yansonalvin.fitnesstracker`.
  - `google-services.json` — present and **tracked by git** (confirmed with `git ls-files`).
    Project `fitness-tracker-c785c`. Its `client[0].oauth_client` array is currently **empty**,
    which is exactly what a project with no Google sign-in client configured looks like. See
    "Facts to confirm" — this file must be regenerated.
  - `src/store/networkStore.ts` + `src/hooks/useNetworkStatus.ts` — the offline signal already
    exists (issue #20). `useNetworkStatus().isOffline` is what disables the sign-in button;
    no new connectivity machinery is needed.
  - `src/store/settingsStore.ts` — the persisted-store precedent (`zustand` + `persist` +
    `createJSONStorage` over `mmkvStorage`, key `@fitness_tracker/settings`). The auth store
    deliberately does **not** copy it; see Data Model.
  - `src/hooks/useNetworkMonitor.ts` and `src/app/_layout.tsx` — the precedent for one
    app-lifetime native subscription mounted once at the root. `useAuthListener()` joins
    `useNetworkMonitor()` and `useHealthConnectSyncQueue()` there.
  - `src/hooks/useHealthConnectAvailability.ts` — the precedent for a hook that owns async
    native actions and exposes a status union plus callbacks. `useAuth` follows it.
  - `src/components/SettingsRow.tsx`, `src/components/HealthConnectStatusCard.tsx` — the two
    Settings building blocks. `SettingsRow` is `{ icon, label, children }`; the account block
    needs an avatar and two full-width tappable rows, so it is a card, not a `SettingsRow`.
  - `src/components/OfflineBanner.tsx` — already rendered at the top of Settings.
  - `src/services/i18n/translations/{en,ja}.json` — flat namespaces (`permissions`, `pairing`,
    `history`, `workout`, `summary`, `settings`, `healthConnect`, `common`, `units`,
    `network`); an `auth` namespace is added to both.
  - `jest.setup.js` — already `jest.mock`s `@react-native-firebase/app` and
    `@react-native-firebase/crashlytics` inline. `__mocks__/` holds hand-written module mocks
    with `__set*` / `__reset*` helpers (`react-native-mmkv.ts`,
    `react-native-health-connect.ts`, `@react-native-community/netinfo.ts`).
- **User impact:** Settings gains an ACCOUNT section. Signed out it offers "Sign in with
  Google" and "Continue as Guest"; signed in it shows the Google display name, email and
  avatar — or the guest label and a "this device only" subtitle — plus a sign-out control.
  Nothing else in the app changes in either state. Sessions recorded while signed out
  stay on the device and are still there after signing in, and after signing out again.
- **Dependencies:**
  - `npx expo install @react-native-firebase/auth @react-native-google-signin/google-signin`
    — both pinned by the Expo SDK 56 resolver, not hand-picked.
    `@react-native-firebase/auth` must match the installed `@react-native-firebase/app`
    (`^26.2.0`).
  - Firebase console: Google enabled as a sign-in provider, and the debug **and** release
    SHA-1/SHA-256 fingerprints registered on the Android app, then `google-services.json`
    re-downloaded.
  - Adding `@react-native-google-signin/google-signin` to `app.json` `plugins` means a native
    rebuild (`pnpm android`) and a new EAS fingerprint — this cannot ship as an OTA update.
  - No new Android permission. `INTERNET` is added by the RN template; `ACCESS_NETWORK_STATE`
    is already declared.
  - Firestore is **not** installed here. Preference sync is issue #22.

### Facts to confirm during implementation

- **`google-services.json` must be regenerated.** Its `oauth_client` array is empty today, so
  Google sign-in cannot work with the committed file. After enabling the provider and adding
  the SHA-1 fingerprints, the new file carries `oauth_client` entries; the one with
  `client_type: 3` is the **web** client ID that `GoogleSignin.configure({ webClientId })`
  requires. Passing the Android (`client_type: 1`) ID instead is the standard cause of
  `DEVELOPER_ERROR`, and so is a missing or mismatched SHA-1 — check both before assuming a
  code bug.
- **The file stays in version control.** Android's `google-services.json` ships inside the APK
  and is not a secret; its API key is restricted to the package name plus registered SHA-1.
  The issue's "kept out of version control if it carries anything sensitive" is answered:
  it does not, so it stays tracked, matching the fact that Crashlytics already depends on it
  being there for a clean checkout to build. Do not add it to `.gitignore`.
- **Modular vs namespaced Firebase API.** React Native Firebase v22+ deprecates the namespaced
  `auth().signInWithCredential(...)` form; `crashService.ts` already uses the modular
  `getCrashlytics()` style. Write auth modular — `getAuth`, `onAuthStateChanged(auth, cb)`,
  `signInWithCredential(auth, credential)`, `signOut(auth)`, `GoogleAuthProvider.credential`.
  Verify the exact export names against the installed `@react-native-firebase/auth` `.d.ts`
  before writing `firebaseAuth.ts`; they are the only place the shape is touched.
  **Confirmed against `auth@26.3.2`:** all five exist at the package root. The `FirebaseAuthTypes`
  namespace, however, is **gone** — the user type is now `User`, exported from the root
  alongside them. Issue #22 must not assume `FirebaseAuthTypes` either.
- **`GoogleSignin.signIn()` return shape.** Recent versions resolve to a discriminated
  `{ type: 'success' | 'cancelled', data }` instead of throwing `SIGN_IN_CANCELLED`. Check the
  installed `.d.ts`: `mapSignInError` must handle whichever form the installed version uses,
  and the cancelled path must reach `'cancelled'` either way.
  **Confirmed against `google-signin@16.1.4`:** it is the discriminated form, so a cancel is a
  return value, not a throw. `requestGoogleIdToken` turns `type !== 'success'` into `null`;
  `mapSignInError` still handles the thrown form, since either can reach it.
- Whether the config plugin needs an explicit `iosUrlScheme`-style option on Android (it
  should not). Register the plugin bare unless the installed plugin's own docs require more.

## Data Model

### Changed: `src/interfaces/auth.ts`

```ts
/** Explicit union, per the project's connection-state convention. */
export type AuthStatus =
  | 'unknown' // before the first onAuthStateChanged callback
  | 'signed-out'
  | 'signing-in' // native sheet open / credential exchange in flight
  | 'signed-in'
  | 'error';

/** The two providers in scope. Anonymous sessions report `isAnonymous: true`. */
export type AuthProvider = 'google' | 'guest';

/** Why a sign-in attempt did not produce a session. */
export type AuthErrorReason =
  | 'cancelled' // user dismissed the Google account sheet
  | 'in-progress' // a sign-in is already running
  | 'play-services-unavailable' // missing, disabled, or outdated Play Services
  | 'network' // offline, or the credential exchange could not reach Firebase
  | 'unknown';

export interface AuthUser {
  uid: string;
  isAnonymous?: boolean;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}
```

`uid` and the optional `isAnonymous` are unchanged, so `setCrashUser` keeps compiling
untouched. The three added fields are all optional and all nullable, because Firebase returns
`null` for any profile field the provider withheld — the UI must render a signed-in user with
no name and no photo.

`'unknown'` is a first-class status covering the window between mount and the first
`onAuthStateChanged` callback. It is what stops the ACCOUNT section flashing a "Sign in"
button for a user who is in fact already signed in.

**No persistence of our own.** Firebase Auth persists the session in native Android storage
and replays it through `onAuthStateChanged` on the next cold start, which is what satisfies
the issue's "survives an app restart" criterion. Writing the user to MMKV as well would create
a second, staleable source of truth — the store is memory-only and rehydrates from Firebase.
Nothing about `@fitness_tracker/settings`, the session history, or `SESSION_SCHEMA_VERSION`
changes.

## Interfaces / API

### `src/services/auth/authErrors.ts` (pure — no React, no native import)

```ts
/** Maps a thrown Google Sign-In / Firebase error to a reason. */
export function mapSignInError(error: unknown): AuthErrorReason;
```

The one piece of genuinely testable logic in the feature, and the reason it is a separate
module: it takes an already-thrown value and returns a union member, so it needs no mocks.

| Input                                                     | Result                        |
| --------------------------------------------------------- | ----------------------------- |
| `code === statusCodes.SIGN_IN_CANCELLED`                  | `'cancelled'`                 |
| `{ type: 'cancelled' }` result (newer API shape)          | `'cancelled'`                 |
| `code === statusCodes.IN_PROGRESS`                        | `'in-progress'`               |
| `code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE`        | `'play-services-unavailable'` |
| `code === 'auth/network-request-failed'`                  | `'network'`                   |
| anything else, including `undefined` and a plain `string` | `'unknown'`                   |

The `statusCodes` values are compared as string constants captured in this module, so it does
not import the native package. Confirm the literal values against the installed `.d.ts`.

They are **not** literals in the `.d.ts`: `statusCodes` is built from native constants at
runtime (`errors/errorCodes.ts` destructures `NativeModule.getConstants()`), which is exactly
why importing it here would drag the native module into a pure unit. The values Android
resolves to are `SIGN_IN_CANCELLED` = `'12501'`, `IN_PROGRESS` = `'ASYNC_OP_IN_PROGRESS'`,
`PLAY_SERVICES_NOT_AVAILABLE` = `'PLAY_SERVICES_NOT_AVAILABLE'`.

### `src/services/auth/googleSignIn.ts` (native adapter, no React)

```ts
/** Idempotent; safe to call more than once. */
export function configureGoogleSignIn(webClientId: string): void;

/** Resolves the Google ID token, or null when the user cancelled. */
export function requestGoogleIdToken(): Promise<string | null>;

/** Clears the local Google session. Never throws. */
export function signOutGoogle(): Promise<void>;
```

`requestGoogleIdToken` calls `hasPlayServices({ showPlayServicesUpdateDialog: true })` before
`signIn()`, so the Play-Services-missing case surfaces as the system's own resolvable dialog
first and only becomes `'play-services-unavailable'` when that fails. It returns `null` for a
cancel — a cancel is a normal outcome, not an error — and rethrows everything else for the
hook to map.

### `src/services/auth/firebaseAuth.ts` (native adapter, no React)

```ts
// `User`, imported from the package root. `FirebaseAuthTypes` no longer exists in v26.
export function toAuthUser(user: User | null): AuthUser | null;

/** Exchanges a Google ID token for a Firebase session. */
export function signInWithGoogleIdToken(idToken: string): Promise<AuthUser>;

/** Creates a guest session. No Play Services, no web client id, no profile fields. */
export function signInAnonymouslyFirebase(): Promise<AuthUser>;

export function signOutFirebase(): Promise<void>;

/** Returns the unsubscribe function. */
export function subscribeToAuthState(
  listener: (user: AuthUser | null) => void,
): () => void;
```

`toAuthUser` is exported separately and tested directly: it is the mapping boundary, and
keeping it a pure function means the null-profile-fields case is covered without touching the
native module.

### `src/services/auth/webClientId.ts`

```ts
/** Reads the web OAuth client id from app config. */
export function getWebClientId(): string | null;
```

Resolves the `client_type: 3` client id through `expo-constants`
(`Constants.expoConfig?.extra?.googleWebClientId`) so the value is configuration, not a
literal in a source file. `app.json` gains that `extra` key. Returns `null` when unset, which
`useAuth` reports as `'unknown'` rather than crashing — a build with an unconfigured Firebase
project must still run every offline flow.

Two callers, for two different reasons. `useAuthListener` skips `configureGoogleSignIn` when
it is `null`. `useAuth` exposes it as `isGoogleSignInAvailable` and makes `signIn` a no-op, so
an unconfigured checkout hides the Google button rather than offering one whose only possible
outcome is `DEVELOPER_ERROR`. It deliberately does **not** override the status: the guest path
needs no OAuth client, so the card stays useful without one.

### `src/store/authStore.ts`

```ts
export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  setStatus: (status: AuthStatus) => void;
  setUser: (user: AuthUser | null) => void; // signed-in / signed-out, clears errorReason
  setError: (reason: AuthErrorReason, status?: AuthStatus) => void; // status defaults to 'error'
}
```

Memory-only, no `persist` middleware. `setUser` is the listener's single write and derives
`status` from its argument, so the two can never disagree.

`setError` takes an optional `status` because a user cancel must land on `'signed-out'`
**carrying** `errorReason: 'cancelled'` — a state the other two setters cannot express, since
`setUser` clears the reason and a bare `setError` would assert a fault. The offline refusal
uses the same shape. Everything genuinely broken takes the `'error'` default.

### `src/hooks/useAuthListener.ts` — the side effect

```ts
/** Subscribes to Firebase auth state for the app's lifetime. Mounted once, at the root. */
export function useAuthListener(): void;
```

One effect, mounted once in `src/app/_layout.tsx`:

1. `configureGoogleSignIn(getWebClientId())` when the id is present.
2. `subscribeToAuthState`, wrapped so a throw goes to `reportError` and leaves the status
   `'unknown'`.
3. Each callback writes through `setUser` and calls `setCrashUser(user)`, so Crashlytics
   reports carry the uid — this is the first caller of the function that already exists.
4. Cleanup unsubscribes.

Split from the reader for the same reason as `useNetworkMonitor` / `useNetworkStatus`: a hook
that takes no arguments cannot be subscribed to twice by accident.

### `src/hooks/useAuth.ts` — the reader and the actions

```ts
export function useAuth(): {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  isSignedIn: boolean;
  isBusy: boolean; // status === 'signing-in'
  isGuest: boolean; // user?.isAnonymous === true
  pendingProvider: AuthProvider | null; // which button is spinning
  isGoogleSignInAvailable: boolean; // false when no web client id is configured
  signIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

`signInAsGuest`: refuses with `'network'` when offline — an anonymous session is still minted
server-side — then `signInAnonymouslyFirebase()`. It touches **neither** `googleSignIn.ts` nor
the web client id, so it works on a device with no Play Services and in a checkout with no
OAuth client configured. Any throw is mapped, stored, and reported: unlike a Google cancel,
there is no user-initiated way for it to fail benignly.

`signOut` is shared. `signOutGoogle()` is a harmless no-op for a guest, so one exit covers both
providers.

`signIn`: refuses with `'network'` when `useNetworkStatus().isOffline`, without opening the
native sheet; otherwise sets `'signing-in'`, gets the ID token, and on `null` (cancel) returns
to `'signed-out'` with `errorReason: 'cancelled'` and no crash report — a cancel is a normal
outcome. Any throw goes through `mapSignInError`, into `setError`, and to `reportError` unless
the reason is `'cancelled'`. On success the `onAuthStateChanged` callback — not `signIn` —
writes the user, so there is exactly one path into the signed-in state.

`signOut`: `signOutFirebase()` then `signOutGoogle()`, so a failure of the Google-side cleanup
cannot leave a live Firebase session behind. Both wrapped; the listener drives the state back
to `'signed-out'`. **Local data is never touched** — no MMKV key is cleared, no session
deleted.

### `src/components/AccountCard.tsx`

```ts
export interface AccountCardProps {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  isOffline: boolean;
  pendingProvider: AuthProvider | null;
  isGoogleSignInAvailable: boolean;
  onSignIn: () => void;
  onSignInAsGuest: () => void;
  onSignOut: () => void;
}
```

Presentational, props only, no store and no service import.

**Compact by design.** The mockup's tall centred identity block (`docs/ui-reference/settings.png`
— 72px avatar, stacked name and subtitle) costs ~200px for one row of information on a screen
that already carries four other sections. Signed in is therefore a **single horizontal row**:
a 40px avatar, a two-line text column, and an icon-only sign-out button. Signed out is **one
row of two buttons**. No section title, no descriptive paragraph — the `ACCOUNT` header plus
the button labels carry the meaning, and the card drops from ~200px to ~64px.

Signed in shows `user.photoURL`, falling back to an Ionicon on a filled circle — a
`person-circle-outline` for Google, a `person-outline` for a guest. The first text line is the
display name (falling back to `auth.signedInFallbackName` when the provider withheld it);
**the second line is what distinguishes the two providers at a glance** — the email for
Google, `auth.guestSubtitle` ("This device only") for a guest. Both are `numberOfLines={1}`,
so a long name or email truncates rather than reflowing the row.

Signed out renders the primary "Sign in with Google" button and the secondary guest button
side by side, each `flex: 1`/`flexShrink` so the pair fits one row; the guest button's visible
text is the short `auth.guestName` while its accessible name stays the fuller
`auth.continueAsGuest`. The Google button is omitted entirely when `isGoogleSignInAvailable`
is false, leaving the guest path reachable. `'unknown'` renders a neutral placeholder row
rather than any of it.

`'signing-in'` disables **both** buttons; `pendingProvider` decides which one swaps its icon
for an `ActivityIndicator` and carries `accessibilityState.busy`. Button labels stay stable
while busy — the spinner and the busy state carry it, so a screen reader is not told the
control was renamed mid-press. Offline disables both and shows `t('auth.errorNetwork')` as
helper text; `errorReason` maps to one line of copy under the buttons. Every tap target is at
least 44px. Tokens from `@/theme` only; `accessibilityRole="button"`, labels, hints, and
`accessibilityState={{ disabled, busy }}` throughout.

"Profile Information" from the mockup is **not** built — there is no profile screen and no
editable profile field in scope. See Constraints.

### i18n keys (added to `en.json` and `ja.json`)

```json
"auth": {
  "sectionLabel": "Account",
  "signInWithGoogle": "Sign in with Google",
  "signInHint": "Signs you in with your Google account",
  "signOut": "Log Out",
  "signOutHint": "Signs you out; your workouts stay on this device",
  "signedInFallbackName": "Signed in",
  "checking": "Checking…",
  "errorCancelled": "Sign-in cancelled.",
  "errorInProgress": "A sign-in is already in progress.",
  "errorPlayServices": "Google Play Services is unavailable or needs an update.",
  "errorNetwork": "You're offline. Connect to the internet to sign in.",
  "errorUnknown": "Sign-in failed. Please try again.",
  "continueAsGuest": "Continue as Guest",
  "continueAsGuestHint": "Signs you in without a Google account",
  "guestName": "Guest",
  "guestSubtitle": "This device only"
}
```

## Files Created

| File                                                     | Purpose                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/services/auth/authErrors.ts`                        | Pure `mapSignInError`. No React, no native import.                  |
| `src/services/auth/googleSignIn.ts`                      | Google Sign-In adapter: configure, ID token, sign out.              |
| `src/services/auth/firebaseAuth.ts`                      | Firebase Auth adapter and `toAuthUser` mapping.                     |
| `src/services/auth/webClientId.ts`                       | Resolves the web OAuth client id from app config.                   |
| `src/store/authStore.ts`                                 | Zustand store: `status`, `user`, `errorReason`, three setters.      |
| `src/hooks/useAuthListener.ts`                           | The `onAuthStateChanged` subscription; mounted once at the root.    |
| `src/hooks/useAuth.ts`                                   | Reader plus `signIn` / `signOut`.                                   |
| `src/components/AccountCard.tsx`                         | The ACCOUNT block on Settings.                                      |
| `__mocks__/@react-native-firebase/auth.ts`               | Manual mock with `__emitAuthState`, `__setSignInResult`, `__reset`. |
| `__mocks__/@react-native-google-signin/google-signin.ts` | Manual mock: `GoogleSignin`, `statusCodes`, `__set*` helpers.       |
| `src/tests/services/auth/authErrors.test.ts`             | Every row of the error mapping table, including unknown input.      |
| `src/tests/services/auth/firebaseAuth.test.ts`           | `toAuthUser` for null, full, and null-profile-field users.          |
| `src/tests/store/authStore.test.ts`                      | Defaults, `setUser` in both directions, `setError`.                 |
| `src/tests/hooks/useAuthListener.test.tsx`               | Write-through, `setCrashUser` call, unsubscribe, throwing path.     |
| `src/tests/hooks/useAuth.test.tsx`                       | Cancel, offline refusal, Play Services, sign-out ordering.          |
| `src/tests/components/AccountCard.test.tsx`              | Each status, offline disabling, a11y state.                         |

## Files Modified

| File                                     | Change                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `package.json` / `pnpm-lock.yaml`        | Adds the two packages via `npx expo install`.                                                     |
| `app.json`                               | Registers the `@react-native-google-signin/google-signin` plugin; adds `extra.googleWebClientId`. |
| `google-services.json`                   | Regenerated from the console with a populated `oauth_client` array. Stays tracked.                |
| `src/interfaces/auth.ts`                 | Adds `AuthStatus`, `AuthErrorReason`; widens `AuthUser` with three optional fields.               |
| `src/app/_layout.tsx`                    | Calls `useAuthListener()` alongside the existing root-mounted hooks.                              |
| `src/app/(tabs)/settings.tsx`            | Adds the ACCOUNT section above Units, wiring `useAuth()` into `<AccountCard />`.                  |
| `src/services/i18n/translations/en.json` | Adds the `auth` namespace.                                                                        |
| `src/services/i18n/translations/ja.json` | Adds the `auth` namespace, translated.                                                            |
| `src/tests/app/settings.test.tsx`        | Asserts the account section renders in each status and that no other control is gated.            |
| `jest.setup.js`                          | Only if the manual mocks need explicit registration; prefer letting `__mocks__` resolve.          |
| `README.md`                              | One paragraph: Firebase console setup, SHA-1 registration, and the native-rebuild note.           |

## Implementation Steps

1. In the Firebase console, enable Google as a sign-in provider on project
   `fitness-tracker-c785c`, register the debug and release SHA-1/SHA-256 fingerprints for
   `com.arcanys.yansonalvin.fitnesstracker`, download the new `google-services.json` and
   replace the committed one. Confirm `client[0].oauth_client` now contains a
   `client_type: 3` entry, and copy that id into `app.json` `extra.googleWebClientId`.
2. `npx expo install @react-native-firebase/auth @react-native-google-signin/google-signin`,
   add the Google Sign-In plugin to `app.json` `plugins`, then `pnpm android` for a native
   rebuild.
3. Widen `src/interfaces/auth.ts` with `AuthStatus`, `AuthErrorReason` and the three optional
   `AuthUser` fields; confirm `src/services/crashService.ts` still type-checks unchanged.
4. Add `src/services/auth/authErrors.ts` and `authErrors.test.ts` covering every row of the
   mapping table plus `undefined`, a bare string, and an `Error` with no `code`.
5. Add `src/services/auth/webClientId.ts`, `googleSignIn.ts` and `firebaseAuth.ts`; write
   `firebaseAuth.test.ts` for `toAuthUser` — `null`, a full user, and a user whose
   `displayName`/`email`/`photoURL` are all `null`.
6. Write `__mocks__/@react-native-firebase/auth.ts` and
   `__mocks__/@react-native-google-signin/google-signin.ts` in the existing manual-mock style.
7. Add `src/store/authStore.ts` and its test.
8. Add `src/hooks/useAuthListener.ts`; test that each emitted user lands in the store, that
   `setCrashUser` is called with it, that exactly one listener is registered and removed on
   unmount, and that a throwing subscribe leaves the status `'unknown'` and reports once.
9. Add `src/hooks/useAuth.ts`; test the cancel path (`'signed-out'` + `'cancelled'`, no
   `reportError`), the offline refusal (`'network'`, native sheet never opened), the Play
   Services failure, and that `signOut` calls Firebase before Google and clears no storage.
10. Add `src/components/AccountCard.tsx` and its test against
    `docs/ui-reference/settings.png`.
11. Add the `auth` namespace to `en.json` and `ja.json`.
12. Wire `useAuthListener()` into `src/app/_layout.tsx` and the ACCOUNT section into
    `src/app/(tabs)/settings.tsx`; extend `src/tests/app/settings.test.tsx`.
13. Document the console setup and the rebuild requirement in `README.md`.
14. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then on a dev-client build — sign in,
    force-stop and reopen the app, confirm still signed in; sign out, confirm history is
    intact; record a full workout while signed out; and dismiss the Google sheet to confirm
    the cancel copy appears with no crash report.

## Style & Conventions

- `CLAUDE.md` layering: `services/auth/` holds no React import; `authErrors.ts` and
  `toAuthUser` hold no native import either, which is what makes them mock-free unit tests.
  `AccountCard` imports nothing from `services/` — Settings wires the hook and passes props,
  matching `HealthConnectStatusCard`.
- **Listener/reader split**, mirroring `useNetworkMonitor` / `useNetworkStatus`:
  `useAuthListener()` takes no arguments and is mounted once at the root; `useAuth()` may be
  called by any screen.
- **Explicit unions, not booleans** — `AuthStatus` and `AuthErrorReason` follow the
  connection-state convention, so `'unknown'` is never confused with signed out.
- **Modular Firebase API**, matching `crashService.ts`'s `getCrashlytics()` style, not the
  deprecated namespaced form.
- Cross-cutting requirements: a11y (`accessibilityRole`, labels, hints,
  `accessibilityState` for disabled/busy), i18n (both translation files, no literal strings),
  crash logging (`reportError` around every sign-in, sign-out and subscribe call — except a
  user cancel, which is not a fault).
- Theme tokens only; `fontFamily` stays unset per the pending-fonts rule.
- Android only: no Apple Sign-In, no `ios` block touched.

## Acceptance Criteria

- [ ] Google sign-in on a dev-client build reaches `status === 'signed-in'` with the Google
      display name and email shown in the Settings ACCOUNT section.
- [ ] Force-stopping and reopening the app returns to `'signed-in'` with the same `uid`, with
      no MMKV key holding the user — the session comes from Firebase's own persistence.
- [ ] Signing out returns the app to `'signed-out'`; session history, units and language are
      byte-identical before and after (verified by reading the MMKV keys around the call).
- [ ] Dismissing the Google account sheet leaves `'signed-out'` with
      `errorReason: 'cancelled'`, shows the cancel copy, and calls `reportError` zero times.
- [ ] With Play Services unavailable, `mapSignInError` yields `'play-services-unavailable'`
      and that copy is shown; the app does not crash.
- [ ] Tapping Sign in while offline sets `errorReason: 'network'` without invoking
      `GoogleSignin.signIn` at all.
- [ ] `mapSignInError` returns `'unknown'` for `undefined`, a bare string, and an `Error`
      with no `code`.
- [ ] `toAuthUser` maps a user whose `displayName`, `email` and `photoURL` are all `null`
      without throwing, and `AccountCard` renders that user with the fallback avatar.
- [ ] `useAuthListener()` registers exactly one listener, removes it on unmount, and calls
      `setCrashUser` with each emitted user.
- [ ] Every Milestone 1 flow works signed out: pairing, connect, a full recorded session,
      history, summary, units and language toggles — no code path reads `authStore` to decide
      whether to proceed, verified by grep.
- [ ] "Continue as Guest" reaches `status === 'signed-in'` with `isAnonymous: true`, shows the
      guest label instead of a name and email, and survives a force-stop with the same `uid`.
- [ ] The guest path works with Play Services unavailable and with no web client id
      configured — neither `GoogleSignin.signIn` nor `hasPlayServices` is invoked by it.
- [ ] Tapping Continue as Guest while offline sets `errorReason: 'network'` without calling
      Firebase.
- [ ] While one provider is signing in, both buttons are disabled and only the pending one
      reports `accessibilityState.busy`.
- [ ] Signing out of a guest session returns to `'signed-out'` and leaves local data intact,
      exactly as for a Google session.
- [ ] `en.json` and `ja.json` both contain every `auth.*` key.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass.

## Constraints

- **Non-goal: gating anything on auth.** Workout recording, BLE, history and Health Connect
  sync never consult the auth store. Auth exists for preference sync (#22) and Crashlytics
  attribution only — this is the issue's own hard requirement.
- **Non-goal: Firestore.** No `@react-native-firebase/firestore`, no preference upload, no
  merge or conflict rules. Issue #22 owns all of it and consumes `useAuth().user` unchanged.
- **Non-goal: "Profile Information".** The mockup's row implies a profile screen, an editable
  display name, and a user-weight field that #31 owns via Health Connect. Building a
  navigation target with nothing behind it would be guessing at #31's shape.
- **Non-goal: email/password.** Google and anonymous are the two providers in scope.
- **Non-goal: account linking.** A guest who later signs in with Google gets a **new** `uid`;
  Firebase abandons the anonymous account rather than upgrading it, and any data written under
  the old `uid` is orphaned. `linkWithCredential` would fix that and is deliberately not built.
  **Decided:** losing guest data on upgrade to Google is accepted behaviour, not a bug. Issue
  #22 may key preferences on the guest `uid` knowing they do not survive a sign-in with Google.
- **Non-goal: pruning anonymous accounts.** Each guest sign-in on a fresh install creates a
  permanent Firebase user and nothing reaps them. Accepted; purge from the console if it grows.
- **Non-goal: account deletion or `revokeAccess()`.** Sign-out clears the local session only.
- **Non-goal: clearing local data on sign-out.** Sessions and preferences are device-local and
  survive a sign-out untouched — the acceptance criteria depend on it.
- **Non-goal: a sign-in gate on launch or a dedicated auth route.** The ACCOUNT section on
  Settings is the whole surface; the app is fully usable having never signed in.
- **No Apple Sign-In, no iOS path** — Android only, per `CLAUDE.md`.
- A dev-client build is required; this cannot be exercised in Expo Go, and the new config
  plugin means it cannot ship as an OTA update — the EAS fingerprint moves.
- Unresolved external facts, all listed above: the versions `npx expo install` selects, the
  installed `@react-native-firebase/auth` modular export names, the `GoogleSignin.signIn()`
  result shape, and the regenerated `google-services.json`. Confirm each against the installed
  package before finalizing the adapters.
