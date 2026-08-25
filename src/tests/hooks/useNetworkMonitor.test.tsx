import { act, renderHook } from '@testing-library/react-native';
import {
  __emit,
  __listenerCount,
  __reset,
  __setAddEventListenerError,
} from '@react-native-community/netinfo';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { reportError } from '@/services/crashService';
import { useNetworkStore } from '@/store/networkStore';

jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

const ONLINE = { isConnected: true, isInternetReachable: true };
const OFFLINE = { isConnected: false, isInternetReachable: false };

function status(): string {
  return useNetworkStore.getState().status;
}

describe('useNetworkMonitor', () => {
  beforeEach(() => {
    __reset();
    useNetworkStore.setState({ status: 'unknown' });
    jest.clearAllMocks();
  });

  it('registers exactly one listener and removes it on unmount', async () => {
    const { unmount } = await renderHook(() => useNetworkMonitor());

    expect(__listenerCount()).toBe(1);

    await act(async () => {
      await unmount();
    });
    expect(__listenerCount()).toBe(0);
  });

  it('writes each emitted state straight to the store', async () => {
    await renderHook(() => useNetworkMonitor());

    __emit(OFFLINE);
    expect(status()).toBe('offline');

    __emit(ONLINE);
    expect(status()).toBe('online');

    __emit(OFFLINE);
    expect(status()).toBe('offline');
  });

  it('maps a connected interface with an in-flight probe to unknown', async () => {
    await renderHook(() => useNetworkMonitor());

    __emit(ONLINE);
    __emit({ isConnected: true, isInternetReachable: null });

    expect(status()).toBe('unknown');
  });

  it('maps a connected interface with no route to offline', async () => {
    await renderHook(() => useNetworkMonitor());

    __emit({ isConnected: true, isInternetReachable: false });

    expect(status()).toBe('offline');
  });

  it('stops writing to the store once unmounted', async () => {
    const { unmount } = await renderHook(() => useNetworkMonitor());

    __emit(ONLINE);
    await act(async () => {
      await unmount();
    });

    __emit(OFFLINE);
    expect(status()).toBe('online');
  });

  it('leaves the status unknown and reports once when addEventListener throws', async () => {
    __setAddEventListenerError(new Error('netinfo unavailable'));

    await renderHook(() => useNetworkMonitor());

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'useNetworkMonitor.addEventListener',
    });
    expect(status()).toBe('unknown');
    expect(__listenerCount()).toBe(0);
  });
});
