import { useAuthStore } from '@/store/authStore';

const SIGNED_IN = { uid: 'uid-1', displayName: 'Alex' };

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      errorReason: null,
    });
  });

  it('starts unknown with no user and no error', () => {
    expect(useAuthStore.getState().status).toBe('unknown');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().errorReason).toBeNull();
  });

  it('derives signed-in from setUser and clears any error', () => {
    useAuthStore.getState().setError('unknown');
    useAuthStore.getState().setUser(SIGNED_IN);

    expect(useAuthStore.getState().status).toBe('signed-in');
    expect(useAuthStore.getState().user).toEqual(SIGNED_IN);
    expect(useAuthStore.getState().errorReason).toBeNull();
  });

  it('derives signed-out from setUser(null)', () => {
    useAuthStore.getState().setUser(SIGNED_IN);
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setError moves to error and records the reason', () => {
    useAuthStore.getState().setError('play-services-unavailable');

    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorReason).toBe(
      'play-services-unavailable',
    );
  });

  it('setError can carry a reason without treating it as a fault', () => {
    useAuthStore.getState().setError('cancelled', 'signed-out');

    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().errorReason).toBe('cancelled');
  });

  it('setStatus leaves the user and reason untouched', () => {
    useAuthStore.getState().setUser(SIGNED_IN);
    useAuthStore.getState().setStatus('signing-in');

    expect(useAuthStore.getState().status).toBe('signing-in');
    expect(useAuthStore.getState().user).toEqual(SIGNED_IN);
  });
});

describe('authStore pendingProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      errorReason: null,
      pendingProvider: null,
    });
  });

  it('setSigningIn records which provider is in flight', () => {
    useAuthStore.getState().setSigningIn('guest');

    expect(useAuthStore.getState().status).toBe('signing-in');
    expect(useAuthStore.getState().pendingProvider).toBe('guest');
    expect(useAuthStore.getState().errorReason).toBeNull();
  });

  it('setUser clears the pending provider', () => {
    useAuthStore.getState().setSigningIn('google');
    useAuthStore.getState().setUser({ uid: 'uid-1' });

    expect(useAuthStore.getState().pendingProvider).toBeNull();
  });

  it('setError clears the pending provider', () => {
    useAuthStore.getState().setSigningIn('google');
    useAuthStore.getState().setError('cancelled', 'signed-out');

    expect(useAuthStore.getState().pendingProvider).toBeNull();
    expect(useAuthStore.getState().errorReason).toBe('cancelled');
  });
});
