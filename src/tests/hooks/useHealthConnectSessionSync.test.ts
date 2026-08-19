import { act, renderHook } from '@testing-library/react-native';
import { useHealthConnectSessionSync } from '@/hooks/useHealthConnectSessionSync';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import * as writerModule from '@/services/healthConnect/writeSessionToHealthConnect';

describe('useHealthConnectSessionSync', () => {
  const mockSession: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1700000000000',
    startedAt: 1700000000000,
    endedAt: 1700003600000,
    stats: {
      durationMs: 3600000,
      avgHr: 140,
      maxHr: 160,
      minHr: 120,
      sampleCount: 2,
      rawSampleCount: 2,
    },
    samples: [
      {
        timestamp: 1700001000000,
        bpm: 130,
        sensorContact: 'contactDetected',
      },
    ],
  };

  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    writeSpy = jest
      .spyOn(writerModule, 'writeSessionToHealthConnect')
      .mockImplementation(async (_session) => ({
        status: 'synced',
        sync: {
          state: 'synced',
          attemptedAt: 1700004000000,
          syncedAt: 1700004000000,
          exerciseRecordId: 'rec-1',
        },
      }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives initial synced state from persisted session and does not auto-attempt on mount', async () => {
    const syncedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'synced',
        attemptedAt: 1700004000000,
        syncedAt: 1700004000000,
        exerciseRecordId: 'rec-1',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(syncedSession),
    );

    expect(result.current.state).toBe('synced');
    expect(result.current.syncedAt).toBe(1700004000000);
    expect(result.current.reason).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('derives initial failed state from persisted session and does not auto-attempt on mount', async () => {
    const failedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'failed',
        attemptedAt: 1700004000000,
        reason: 'unavailable',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(failedSession),
    );

    expect(result.current.state).toBe('failed');
    expect(result.current.reason).toBe('unavailable');
    expect(result.current.syncedAt).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('derives initial abandoned state from persisted session and does not auto-attempt on mount', async () => {
    const abandonedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'abandoned',
        attemptedAt: 1700004000000,
        failedAttempts: 5,
        reason: 'write-failed',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(abandonedSession),
    );

    expect(result.current.state).toBe('abandoned');
    expect(result.current.reason).toBe('write-failed');
    expect(result.current.syncedAt).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('auto-attempts once on mount for never-synced session and updates to synced', async () => {
    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(mockSession, { title: 'Test Workout' }),
    );

    expect(writeSpy).toHaveBeenCalledWith(mockSession, {
      title: 'Test Workout',
      manual: undefined,
    });

    await act(async () => {});

    expect(result.current.state).toBe('synced');
    expect(result.current.syncedAt).toBe(1700004000000);
    expect(result.current.reason).toBeNull();
  });

  it('auto-attempts on mount and updates to failed when writer fails', async () => {
    writeSpy.mockResolvedValueOnce({
      status: 'failed',
      sync: {
        state: 'failed',
        attemptedAt: 1700004000000,
        reason: 'permission-denied',
      },
    });

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(mockSession),
    );

    await act(async () => {});

    expect(result.current.state).toBe('failed');
    expect(result.current.reason).toBe('permission-denied');
    expect(result.current.syncedAt).toBeNull();
  });

  it('auto-attempts on mount and updates to abandoned when writer marks abandoned', async () => {
    writeSpy.mockResolvedValueOnce({
      status: 'failed',
      sync: {
        state: 'abandoned',
        attemptedAt: 1700004000000,
        failedAttempts: 5,
        reason: 'write-failed',
      },
    });

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(mockSession),
    );

    await act(async () => {});

    expect(result.current.state).toBe('abandoned');
    expect(result.current.reason).toBe('write-failed');
    expect(result.current.syncedAt).toBeNull();
  });

  it('allows retry on failed state and passes manual: true', async () => {
    const failedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'failed',
        attemptedAt: 1700004000000,
        reason: 'write-failed',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(failedSession),
    );

    expect(writeSpy).not.toHaveBeenCalled();

    await act(async () => {
      result.current.retry();
    });

    expect(writeSpy).toHaveBeenCalledWith(failedSession, {
      title: undefined,
      manual: true,
    });
    expect(result.current.state).toBe('synced');
    expect(result.current.syncedAt).toBe(1700004000000);
  });

  it('allows retry on abandoned state and passes manual: true', async () => {
    const abandonedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'abandoned',
        attemptedAt: 1700004000000,
        failedAttempts: 5,
        reason: 'write-failed',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(abandonedSession),
    );

    expect(writeSpy).not.toHaveBeenCalled();

    await act(async () => {
      result.current.retry();
    });

    expect(writeSpy).toHaveBeenCalledWith(abandonedSession, {
      title: undefined,
      manual: true,
    });
    expect(result.current.state).toBe('synced');
    expect(result.current.syncedAt).toBe(1700004000000);
  });

  it('does nothing when retry is called while synced or syncing', async () => {
    const syncedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'synced',
        attemptedAt: 1700004000000,
        syncedAt: 1700004000000,
        exerciseRecordId: 'rec-1',
      },
    };

    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(syncedSession),
    );

    await act(async () => {
      result.current.retry();
    });

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('is inert when session is null', async () => {
    const { result } = await renderHook(() =>
      useHealthConnectSessionSync(null),
    );

    expect(result.current.state).toBe('unsynced');
    expect(result.current.reason).toBeNull();
    expect(result.current.syncedAt).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();

    await act(async () => {
      result.current.retry();
    });

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('does not perform state updates after unmount', async () => {
    let resolveWrite: (value: any) => void;
    writeSpy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
    );

    const { unmount } = await renderHook(() =>
      useHealthConnectSessionSync(mockSession),
    );

    await act(async () => {
      await unmount();
    });

    await act(async () => {
      resolveWrite!({
        status: 'synced',
        sync: {
          state: 'synced',
          attemptedAt: 1700004000000,
          syncedAt: 1700004000000,
          exerciseRecordId: 'rec-1',
        },
      });
    });
  });
});
