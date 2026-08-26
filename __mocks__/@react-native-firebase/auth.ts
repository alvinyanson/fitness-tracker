declare module '@react-native-firebase/auth' {
  export interface MockFirebaseUser {
    uid: string;
    isAnonymous: boolean;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }
  export const __calls: string[];
  export function __setSubscribeError(error: Error | null): void;
  export function __emitAuthState(user: MockFirebaseUser | null): void;
  export function __setSignInResult(
    result: { user: MockFirebaseUser } | null,
  ): void;
  export function __setSignInError(error: unknown): void;
  export function __setAnonymousError(error: unknown): void;
  export function __setSignOutError(error: unknown): void;
  export function __listenerCount(): number;
  export function __reset(): void;
}

export interface MockFirebaseUser {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

type Listener = (user: MockFirebaseUser | null) => void;

let listeners: Listener[] = [];
let subscribeError: Error | null = null;
let signInResult: { user: MockFirebaseUser } | null = null;
let signInError: unknown = null;
let anonymousError: unknown = null;
let signOutError: unknown = null;

export const __calls: string[] = [];

/** Makes `onAuthStateChanged` throw, simulating an unavailable native module. */
export function __setSubscribeError(error: Error | null): void {
  subscribeError = error;
}

/** Broadcasts an auth state to every registered listener. */
export function __emitAuthState(user: MockFirebaseUser | null): void {
  // Unsubscribing reassigns `listeners`, so this iterator keeps a stable snapshot.
  for (const listener of listeners) {
    listener(user);
  }
}

export function __setSignInResult(
  result: { user: MockFirebaseUser } | null,
): void {
  signInResult = result;
}

export function __setSignInError(error: unknown): void {
  signInError = error;
}

export function __setAnonymousError(error: unknown): void {
  anonymousError = error;
}

export function __setSignOutError(error: unknown): void {
  signOutError = error;
}

/** Number of currently registered listeners — asserts subscribe/unsubscribe. */
export function __listenerCount(): number {
  return listeners.length;
}

export function __reset(): void {
  listeners = [];
  subscribeError = null;
  signInResult = null;
  signInError = null;
  anonymousError = null;
  signOutError = null;
  __calls.length = 0;
}

export function getAuth(): { __mock: true } {
  return { __mock: true };
}

export const GoogleAuthProvider = {
  credential: (idToken?: string | null) => ({
    providerId: 'google.com',
    token: idToken,
  }),
};

export function onAuthStateChanged(
  _auth: unknown,
  listener: Listener,
): () => void {
  if (subscribeError) {
    throw subscribeError;
  }
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
  };
}

export async function signInWithCredential(): Promise<{
  user: MockFirebaseUser;
}> {
  __calls.push('signInWithCredential');
  if (signInError) throw signInError;
  if (!signInResult) {
    throw new Error('__setSignInResult was not called');
  }
  return signInResult;
}

export async function signInAnonymously(): Promise<{ user: MockFirebaseUser }> {
  __calls.push('signInAnonymously');
  if (anonymousError) throw anonymousError;
  return {
    user: {
      uid: 'anon-uid',
      isAnonymous: true,
      email: null,
      displayName: null,
      photoURL: null,
    },
  };
}

export async function signOut(): Promise<void> {
  __calls.push('firebase.signOut');
  if (signOutError) throw signOutError;
}
