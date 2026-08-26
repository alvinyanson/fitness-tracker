import { renderHook, act } from '@testing-library/react-native';
import {
  __calls as firebaseCalls,
  __reset as resetFirebase,
  __setAnonymousError,
  __setSignInResult,
} from '@react-native-firebase/auth';
import {
  __calls as googleCalls,
  __reset as resetGoogle,
  __setPlayServicesError,
  __setSignInError,
  __setSignInResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { createMMKV } from 'react-native-mmkv';
import { useAuth } from '@/hooks/useAuth';
import { __resetGoogleSignInConfig } from '@/services/auth/googleSignIn';
import { reportError } from '@/services/crashService';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/authStore';
import { useNetworkStore } from '@/store/networkStore';

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-google-signin/google-signin');
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleWebClientId: 'web-client-id' } } },
}));
jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  setCrashUser: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

const NATIVE_USER = {
  uid: 'uid-1',
  isAnonymous: false,
  email: 'alex@example.com',
  displayName: 'Alex Rivera',
  photoURL: null,
};

function setWebClientId(value: string | undefined): void {
  (
    Constants as { expoConfig: { extra: Record<string, unknown> } }
  ).expoConfig.extra.googleWebClientId = value;
}

function storageSnapshot(): string {
  const mmkv = createMMKV();
  return JSON.stringify(
    mmkv.getAllKeys().map((key) => [key, mmkv.getString(key)]),
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    resetFirebase();
    resetGoogle();
    __resetGoogleSignInConfig();
    __setSignInResult({ user: NATIVE_USER });
    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      errorReason: null,
    });
    useNetworkStore.setState({ status: 'online' });
    setWebClientId('web-client-id');
    jest.clearAllMocks();
  });

  it('exchanges the Google ID token without writing the user itself', async () => {
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(googleCalls).toEqual(['hasPlayServices', 'signIn']);
    expect(firebaseCalls).toContain('signInWithCredential');
    // Only the onAuthStateChanged listener writes the user.
    expect(useAuthStore.getState().user).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('treats a dismissed account sheet as a normal outcome', async () => {
    __setSignInResponse({ type: 'cancelled', data: null });
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().errorReason).toBe('cancelled');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('maps a thrown cancel code to cancelled without reporting', async () => {
    __setSignInError({ code: statusCodes.SIGN_IN_CANCELLED });
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().errorReason).toBe('cancelled');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('refuses while offline without opening the native sheet', async () => {
    useNetworkStore.setState({ status: 'offline' });
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(googleCalls).toEqual([]);
    expect(useAuthStore.getState().errorReason).toBe('network');
    expect(useAuthStore.getState().status).toBe('signed-out');
  });

  it('surfaces a Play Services failure and reports it', async () => {
    __setPlayServicesError({ code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE });
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn();
    });

    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorReason).toBe(
      'play-services-unavailable',
    );
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('signs out of Firebase before Google', async () => {
    const { result } = await renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(firebaseCalls).toContain('firebase.signOut');
    expect(googleCalls).toContain('google.signOut');
  });

  it('clears no local storage on sign out', async () => {
    const mmkv = createMMKV();
    mmkv.set('@fitness_tracker/settings', '{"units":"metric"}');
    const before = storageSnapshot();

    const { result } = await renderHook(() => useAuth());
    await act(async () => {
      await result.current.signOut();
    });

    expect(storageSnapshot()).toBe(before);
  });

  describe('signInAsGuest', () => {
    it('creates an anonymous session without touching Google', async () => {
      const { result } = await renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInAsGuest();
      });

      expect(firebaseCalls).toContain('signInAnonymously');
      // No Play Services check, no account sheet.
      expect(googleCalls).toEqual([]);
      expect(reportError).not.toHaveBeenCalled();
      // Only the onAuthStateChanged listener writes the user.
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('refuses while offline without calling Firebase', async () => {
      useNetworkStore.setState({ status: 'offline' });
      const { result } = await renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInAsGuest();
      });

      expect(firebaseCalls).not.toContain('signInAnonymously');
      expect(useAuthStore.getState().status).toBe('signed-out');
      expect(useAuthStore.getState().errorReason).toBe('network');
    });

    it('reports a failure and lands in error', async () => {
      __setAnonymousError({ code: 'auth/operation-not-allowed' });
      const { result } = await renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInAsGuest();
      });

      expect(useAuthStore.getState().status).toBe('error');
      expect(useAuthStore.getState().errorReason).toBe('unknown');
      expect(reportError).toHaveBeenCalledTimes(1);
    });

    it('marks the guest button busy while in flight', async () => {
      const { result } = await renderHook(() => useAuth());

      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = result.current.signInAsGuest();
        // The store is written synchronously before the first await resolves.
        expect(useAuthStore.getState().pendingProvider).toBe('guest');
        expect(useAuthStore.getState().status).toBe('signing-in');
        await pending;
      });
    });
  });

  describe('isGuest', () => {
    it('is true only for an anonymous user', async () => {
      useAuthStore.setState({
        status: 'signed-in',
        user: { uid: 'anon-uid', isAnonymous: true },
      });
      const { result } = await renderHook(() => useAuth());
      expect(result.current.isGuest).toBe(true);
    });

    it('is false for a Google user', async () => {
      useAuthStore.setState({
        status: 'signed-in',
        user: { uid: 'uid-1', isAnonymous: false },
      });
      const { result } = await renderHook(() => useAuth());
      expect(result.current.isGuest).toBe(false);
    });
  });

  describe('with no web client id configured', () => {
    beforeEach(() => {
      setWebClientId(undefined);
    });

    it('reports Google sign-in as unavailable', async () => {
      const { result } = await renderHook(() => useAuth());

      expect(result.current.isGoogleSignInAvailable).toBe(false);
    });

    it('refuses to sign in without opening the native sheet', async () => {
      const { result } = await renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(googleCalls).toEqual([]);
      expect(reportError).not.toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('signed-out');
    });

    it('still allows the guest path', async () => {
      const { result } = await renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInAsGuest();
      });

      expect(firebaseCalls).toContain('signInAnonymously');
      expect(reportError).not.toHaveBeenCalled();
    });
  });
});
