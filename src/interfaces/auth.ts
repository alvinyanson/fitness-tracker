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
