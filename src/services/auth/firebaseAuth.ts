import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from '@react-native-firebase/auth';
import type { AuthUser } from '@/interfaces/auth';

/** The mapping boundary between the native user and the app's own shape. */
export function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/** Exchanges a Google ID token for a Firebase session. */
export async function signInWithGoogleIdToken(
  idToken: string,
): Promise<AuthUser> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getAuth(), credential);

  const user = toAuthUser(result.user);
  if (!user) {
    throw new Error('Firebase returned no user for the Google credential');
  }
  return user;
}

/** Creates a guest session. No Play Services, no web client id, no profile fields. */
export async function signInAnonymouslyFirebase(): Promise<AuthUser> {
  const result = await signInAnonymously(getAuth());

  const user = toAuthUser(result.user);
  if (!user) {
    throw new Error('Firebase returned no user for the anonymous sign-in');
  }
  return user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getAuth());
}

/** Returns the unsubscribe function. */
export function subscribeToAuthState(
  listener: (user: AuthUser | null) => void,
): () => void {
  return onAuthStateChanged(getAuth(), (user) => {
    listener(toAuthUser(user));
  });
}
