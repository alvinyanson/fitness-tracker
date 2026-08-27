import { act, renderHook } from '@testing-library/react-native';
import {
  __calls,
  __emitSnapshot,
  __getDocumentData,
  __listenerCount,
  __reset,
  __setDocumentData,
  __setWriteError,
} from '@react-native-firebase/firestore';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';
import { reportError } from '@/services/crashService';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

jest.mock('@react-native-firebase/firestore');
jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

const WRITE_DEBOUNCE_MS = 1500;

function signIn({ isAnonymous = false } = {}) {
  useAuthStore.setState({
    status: 'signed-in',
    user: { uid: 'uid-1', isAnonymous },
    errorReason: null,
    pendingProvider: null,
  });
}

function signOut() {
  useAuthStore.setState({
    status: 'signed-out',
    user: null,
    errorReason: null,
    pendingProvider: null,
  });
}

// Fake timers still run microtasks, so an empty act flushes the async reconcile chain.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceDebounce(multiplier = 1) {
  await act(async () => {
    jest.advanceTimersByTime(WRITE_DEBOUNCE_MS * multiplier);
  });
  await flush();
}

// Signed in before mount: the effect then runs on the first render, no transition needed.
async function renderSignedIn(options?: { isAnonymous?: boolean }) {
  signIn(options);
  const view = await renderHook(() => usePreferencesSync());
  await flush();
  return view;
}

describe('usePreferencesSync', () => {
  beforeEach(() => {
    __reset();
    jest.clearAllMocks();
    jest.useFakeTimers();
    signOut();
    useSettingsStore.setState({
      units: 'metric',
      language: 'en',
      updatedAt: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies a newer remote document on sign-in', async () => {
    __setDocumentData({ units: 'imperial', language: 'ja', updatedAt: 5_000 });

    await renderSignedIn();

    expect(useSettingsStore.getState().units).toBe('imperial');
    expect(useSettingsStore.getState().language).toBe('ja');
    expect(useSettingsStore.getState().updatedAt).toBe(5_000);
    expect(__calls).not.toContain('setDoc:users/uid-1');
  });

  it('pushes a newer local value on sign-in', async () => {
    useSettingsStore.setState({
      units: 'imperial',
      language: 'en',
      updatedAt: 9_000,
    });
    __setDocumentData({ units: 'metric', language: 'ja', updatedAt: 1_000 });

    await renderSignedIn();

    expect(__getDocumentData()).toEqual({
      units: 'imperial',
      language: 'en',
      updatedAt: 9_000,
    });
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('leaves local settings alone when the remote document is invalid', async () => {
    __setDocumentData({ units: 'stones', language: 'xx', updatedAt: 9_000 });

    await renderSignedIn();

    expect(__calls).toContain('onSnapshot:users/uid-1');
    expect(useSettingsStore.getState().units).toBe('metric');
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('pushes a store change once after the debounce window', async () => {
    await renderSignedIn();
    expect(__listenerCount()).toBe(1);
    __calls.length = 0;

    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
      useSettingsStore.getState().setLanguage('ja');
    });
    expect(__calls).toEqual([]);

    await advanceDebounce();

    expect(__calls.filter((call) => call.startsWith('setDoc'))).toHaveLength(1);
    expect(__getDocumentData()).toMatchObject({
      units: 'imperial',
      language: 'ja',
    });
  });

  it('does not write again for a snapshot echoing its own push', async () => {
    await renderSignedIn();

    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
    });
    await advanceDebounce();
    expect(__getDocumentData()).toMatchObject({ units: 'imperial' });

    const pushed = useSettingsStore.getState().updatedAt;
    __calls.length = 0;

    await act(async () => {
      __emitSnapshot({ units: 'imperial', language: 'en', updatedAt: pushed });
    });
    await advanceDebounce(2);

    expect(__calls).toEqual([]);
    expect(useSettingsStore.getState().updatedAt).toBe(pushed);
  });

  it('unsubscribes and cancels the pending write on sign-out', async () => {
    await renderSignedIn();
    expect(__listenerCount()).toBe(1);

    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
    });
    __calls.length = 0;

    await act(async () => {
      signOut();
    });

    expect(__listenerCount()).toBe(0);

    await advanceDebounce(2);

    expect(__calls).toEqual([]);
    expect(useSettingsStore.getState().units).toBe('imperial');
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('makes no Firestore call at all while signed out', async () => {
    await renderHook(() => usePreferencesSync());

    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
    });
    await advanceDebounce(2);

    expect(__calls).toEqual([]);
    expect(__listenerCount()).toBe(0);
    expect(useSettingsStore.getState().units).toBe('imperial');
  });

  it('neither reads, writes, nor subscribes for a guest session', async () => {
    __setDocumentData({ units: 'imperial', language: 'ja', updatedAt: 9_000 });

    await renderSignedIn({ isAnonymous: true });

    await act(async () => {
      useSettingsStore.getState().setLanguage('ja');
    });
    await advanceDebounce(2);

    expect(__calls).toEqual([]);
    expect(__listenerCount()).toBe(0);
    expect(useSettingsStore.getState().units).toBe('metric');
    expect(useSettingsStore.getState().language).toBe('ja');
  });

  it('reports a write failure and changes nothing on screen', async () => {
    await renderSignedIn();
    __setWriteError(new Error('permission-denied'));

    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
    });
    await advanceDebounce();

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: 'firestorePreferences.writePreferences',
      uid: 'uid-1',
    });
    expect(useSettingsStore.getState().units).toBe('imperial');
  });
});
