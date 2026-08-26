import { useEffect } from 'react';
import { reportError, setCrashUser } from '@/services/crashService';
import { configureGoogleSignIn } from '@/services/auth/googleSignIn';
import { subscribeToAuthState } from '@/services/auth/firebaseAuth';
import { getWebClientId } from '@/services/auth/webClientId';
import { useAuthStore } from '@/store/authStore';

/** Subscribes to Firebase auth state for the app's lifetime. Mounted once, at the root. */
export function useAuthListener(): void {
  useEffect(() => {
    const webClientId = getWebClientId();
    if (webClientId) {
      try {
        configureGoogleSignIn(webClientId);
      } catch (error) {
        reportError(error, { source: 'useAuthListener.configureGoogleSignIn' });
      }
    }

    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = subscribeToAuthState((user) => {
        useAuthStore.getState().setUser(user);
        setCrashUser(user);
      });
    } catch (error) {
      // Status stays 'unknown': we cannot claim signed-out without ever having heard back.
      reportError(error, { source: 'useAuthListener.subscribeToAuthState' });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);
}
