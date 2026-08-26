import { useCallback } from 'react';
import type {
  AuthErrorReason,
  AuthProvider,
  AuthStatus,
  AuthUser,
} from '@/interfaces/auth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { mapSignInError } from '@/services/auth/authErrors';
import {
  signInAnonymouslyFirebase,
  signInWithGoogleIdToken,
  signOutFirebase,
} from '@/services/auth/firebaseAuth';
import {
  requestGoogleIdToken,
  signOutGoogle,
} from '@/services/auth/googleSignIn';
import { getWebClientId } from '@/services/auth/webClientId';
import { reportError } from '@/services/crashService';
import { useAuthStore } from '@/store/authStore';

export function useAuth(): {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  isSignedIn: boolean;
  isBusy: boolean;
  isGuest: boolean;
  pendingProvider: AuthProvider | null;
  /** False when no web client id is configured; the guest path stays available. */
  isGoogleSignInAvailable: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const errorReason = useAuthStore((state) => state.errorReason);
  const pendingProvider = useAuthStore((state) => state.pendingProvider);
  const { isOffline } = useNetworkStatus();
  // A missing web client id makes Google sign-in impossible, not the whole card useless:
  // the guest path needs neither an OAuth client nor Play Services.
  const isGoogleSignInAvailable = getWebClientId() !== null;

  const signIn = useCallback(async () => {
    if (!isGoogleSignInAvailable) return;

    const { setSigningIn, setError } = useAuthStore.getState();

    if (isOffline) {
      setError('network', 'signed-out');
      return;
    }

    setSigningIn('google');

    try {
      const idToken = await requestGoogleIdToken();
      if (idToken === null) {
        // A dismissed account sheet is a normal outcome, not a fault: no crash report.
        setError('cancelled', 'signed-out');
        return;
      }
      // The onAuthStateChanged listener writes the user — the only path into 'signed-in'.
      await signInWithGoogleIdToken(idToken);
    } catch (error) {
      const reason = mapSignInError(error);
      setError(reason, reason === 'cancelled' ? 'signed-out' : 'error');
      if (reason !== 'cancelled') {
        reportError(error, { source: 'useAuth.signIn', reason });
      }
    }
  }, [isOffline, isGoogleSignInAvailable]);

  const signInAsGuest = useCallback(async () => {
    const { setSigningIn, setError } = useAuthStore.getState();

    // Anonymous sign-in still mints a real session server-side, so it needs the network.
    if (isOffline) {
      setError('network', 'signed-out');
      return;
    }

    setSigningIn('guest');

    try {
      // As with Google, the listener writes the user; this only triggers the event.
      await signInAnonymouslyFirebase();
    } catch (error) {
      const reason = mapSignInError(error);
      setError(reason);
      reportError(error, { source: 'useAuth.signInAsGuest', reason });
    }
  }, [isOffline]);

  const signOut = useCallback(async () => {
    // Firebase first, so a failed Google cleanup cannot leave a live session behind.
    try {
      await signOutFirebase();
    } catch (error) {
      reportError(error, { source: 'useAuth.signOut.firebase' });
      return;
    }

    try {
      await signOutGoogle();
    } catch (error) {
      reportError(error, { source: 'useAuth.signOut.google' });
    }
  }, []);

  return {
    status,
    user,
    errorReason,
    isSignedIn: status === 'signed-in',
    isBusy: status === 'signing-in',
    isGuest: user?.isAnonymous === true,
    pendingProvider,
    isGoogleSignInAvailable,
    signIn,
    signInAsGuest,
    signOut,
  };
}
