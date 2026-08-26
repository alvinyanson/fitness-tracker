import { GoogleSignin } from '@react-native-google-signin/google-signin';

let configured = false;

/** Idempotent; safe to call more than once. */
export function configureGoogleSignIn(webClientId: string): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId });
  configured = true;
}

/** Resolves the Google ID token, or null when the user cancelled. */
export async function requestGoogleIdToken(): Promise<string | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') return null;

  return result.data.idToken;
}

/** Clears the local Google session. Never throws. */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // A stale Google session is not worth surfacing; Firebase sign-out is the one that matters.
  }
}

/** Test seam only — resets the `configure` guard between cases. */
export function __resetGoogleSignInConfig(): void {
  configured = false;
}
