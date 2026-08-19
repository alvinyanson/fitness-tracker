import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useHealthConnectSyncQueue } from '@/hooks/useHealthConnectSyncQueue';
import { useHealthConnectSyncStore } from '@/store/healthConnectSyncStore';

describe('useHealthConnectSyncQueue', () => {
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];
  let flushSpy: jest.SpyInstance;
  let refreshSpy: jest.SpyInstance;

  beforeEach(() => {
    appStateListeners = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, handler) => {
        appStateListeners.push(handler as (state: AppStateStatus) => void);
        return {
          remove: jest.fn(() => {
            appStateListeners = appStateListeners.filter((h) => h !== handler);
          }),
        };
      });

    flushSpy = jest
      .spyOn(useHealthConnectSyncStore.getState(), 'flush')
      .mockResolvedValue();
    refreshSpy = jest
      .spyOn(useHealthConnectSyncStore.getState(), 'refresh')
      .mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls refresh on mount and does not register listener when autoFlushOnForeground is false', async () => {
    const { result } = await renderHook(() => useHealthConnectSyncQueue());

    expect(refreshSpy).toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
    expect(flushSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('flushes on mount and listens for active edge when autoFlushOnForeground is true', async () => {
    const { unmount } = await renderHook(() =>
      useHealthConnectSyncQueue({
        autoFlushOnForeground: true,
        title: 'Auto Title',
      }),
    );

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(flushSpy).toHaveBeenCalledWith({
      manual: false,
      title: 'Auto Title',
    });

    // Simulate transition to background, then back to active
    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
    });

    await act(async () => {
      appStateListeners.forEach((listener) => listener('active'));
    });

    expect(flushSpy).toHaveBeenCalledTimes(2);

    // Repeated active without background should NOT trigger another flush
    await act(async () => {
      appStateListeners.forEach((listener) => listener('active'));
    });

    expect(flushSpy).toHaveBeenCalledTimes(2);

    // Unmount removes listener
    await act(async () => {
      await unmount();
    });

    expect(appStateListeners).toHaveLength(0);
  });

  it('syncNow() triggers flush with manual: true', async () => {
    const { result } = await renderHook(() =>
      useHealthConnectSyncQueue({ title: 'My Workout' }),
    );

    await act(async () => {
      result.current.syncNow();
    });

    expect(flushSpy).toHaveBeenCalledWith({
      manual: true,
      title: 'My Workout',
    });
  });
});
