import { act } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import type { HealthConnectFlushResult } from '@/interfaces/healthConnect';
import {
  SESSION_SCHEMA_VERSION,
  type PersistedSession,
} from '@/interfaces/session';
import * as pendingSyncModule from '@/services/healthConnect/pendingSessionSync';
import { saveSession } from '@/services/storage/sessionHistoryStorage';
import { useHealthConnectSyncStore } from '@/store/healthConnectSyncStore';

describe('healthConnectSyncStore', () => {
  function createMockSession(id: string): PersistedSession {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id,
      startedAt: 1000000,
      endedAt: 2000000,
      stats: {
        durationMs: 1000000,
        avgHr: 140,
        maxHr: 160,
        minHr: 120,
        sampleCount: 1,
        rawSampleCount: 1,
      },
      samples: [],
    };
  }

  beforeEach(() => {
    createMMKV().clearAll();
    jest.clearAllMocks();
    useHealthConnectSyncStore.setState({
      status: 'idle',
      summary: { pending: 0, eligible: 0, abandoned: 0 },
      lastResult: null,
    });
  });

  it('has initial idle state and empty summary', () => {
    const state = useHealthConnectSyncStore.getState();
    expect(state.status).toBe('idle');
    expect(state.summary).toEqual({ pending: 0, eligible: 0, abandoned: 0 });
    expect(state.lastResult).toBeNull();
  });

  it('refresh() recomputes summary from storage', () => {
    saveSession(createMockSession('session-1'));
    saveSession(createMockSession('session-2'));

    act(() => {
      useHealthConnectSyncStore.getState().refresh();
    });

    const state = useHealthConnectSyncStore.getState();
    expect(state.summary.pending).toBe(2);
    expect(state.summary.eligible).toBe(2);
  });

  it('flush() sets status to flushing and updates lastResult and summary upon completion', async () => {
    const mockFlushResult: HealthConnectFlushResult = {
      attempted: 1,
      synced: 1,
      failed: 0,
      abandoned: 0,
      deferred: 0,
      skipped: null,
      finishedAt: 1700000000000,
    };

    let resolveFlush: (val: HealthConnectFlushResult) => void;
    jest.spyOn(pendingSyncModule, 'flushPendingSessions').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFlush = resolve;
        }),
    );

    let flushPromise: Promise<void>;
    act(() => {
      flushPromise = useHealthConnectSyncStore
        .getState()
        .flush({ manual: true });
    });

    expect(useHealthConnectSyncStore.getState().status).toBe('flushing');

    await act(async () => {
      resolveFlush!(mockFlushResult);
      await flushPromise;
    });

    expect(useHealthConnectSyncStore.getState().status).toBe('idle');
    expect(useHealthConnectSyncStore.getState().lastResult).toEqual(
      mockFlushResult,
    );
  });

  it('flush() does not start a second flush when already flushing', async () => {
    const flushSpy = jest
      .spyOn(pendingSyncModule, 'flushPendingSessions')
      .mockReturnValue(new Promise(() => {})); // never resolves

    act(() => {
      useHealthConnectSyncStore.getState().flush();
    });
    expect(flushSpy).toHaveBeenCalledTimes(1);

    act(() => {
      useHealthConnectSyncStore.getState().flush();
    });
    // Still 1 call
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
});
