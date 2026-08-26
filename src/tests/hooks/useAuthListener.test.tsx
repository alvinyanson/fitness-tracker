import { renderHook, act } from '@testing-library/react-native';
import {
  __emitAuthState,
  __listenerCount,
  __reset,
  __setSubscribeError,
} from '@react-native-firebase/auth';
import { useAuthListener } from '@/hooks/useAuthListener';
import { reportError, setCrashUser } from '@/services/crashService';
import { useAuthStore } from '@/store/authStore';

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-google-signin/google-signin');
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

describe('useAuthListener', () => {
  beforeEach(() => {
    __reset();
    __setSubscribeError(null);
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      errorReason: null,
    });
    jest.clearAllMocks();
  });

  it('registers exactly one listener and removes it on unmount', async () => {
    const { unmount } = await renderHook(() => useAuthListener());

    expect(__listenerCount()).toBe(1);

    await act(async () => {
      await unmount();
    });
    expect(__listenerCount()).toBe(0);
  });

  it('writes each emitted user into the store', async () => {
    await renderHook(() => useAuthListener());

    await act(async () => {
      __emitAuthState(NATIVE_USER);
    });
    expect(useAuthStore.getState().status).toBe('signed-in');
    expect(useAuthStore.getState().user?.uid).toBe('uid-1');

    await act(async () => {
      __emitAuthState(null);
    });
    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('attributes crash reports to each emitted user', async () => {
    await renderHook(() => useAuthListener());

    await act(async () => {
      __emitAuthState(NATIVE_USER);
    });
    expect(setCrashUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-1' }),
    );

    await act(async () => {
      __emitAuthState(null);
    });
    expect(setCrashUser).toHaveBeenLastCalledWith(null);
  });

  it('leaves the status unknown and reports once when subscribe throws', async () => {
    __setSubscribeError(new Error('native module missing'));

    await renderHook(() => useAuthListener());

    expect(useAuthStore.getState().status).toBe('unknown');
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'useAuthListener.subscribeToAuthState',
    });
  });
});
