import { act, renderHook } from '@testing-library/react-native';
import { __listenerCount, __reset } from '@react-native-community/netinfo';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNetworkStore } from '@/store/networkStore';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    __reset();
    useNetworkStore.setState({ status: 'unknown' });
  });

  it('reports unknown with both flags false, and registers no NetInfo listener', async () => {
    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.status).toBe('unknown');
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isOnline).toBe(false);
    expect(__listenerCount()).toBe(0);
  });

  it('derives isOnline when the store is online', async () => {
    useNetworkStore.setState({ status: 'online' });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.status).toBe('online');
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('derives isOffline when the store is offline', async () => {
    useNetworkStore.setState({ status: 'offline' });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.status).toBe('offline');
    expect(result.current.isOffline).toBe(true);
    expect(result.current.isOnline).toBe(false);
  });

  it('tracks later store updates', async () => {
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(false);

    await act(async () => {
      useNetworkStore.getState().setStatus('offline');
    });

    expect(result.current.isOffline).toBe(true);
    expect(__listenerCount()).toBe(0);
  });
});
