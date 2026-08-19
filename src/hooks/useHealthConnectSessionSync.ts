import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  HealthConnectSyncState,
  HealthConnectWriteFailureReason,
} from '@/interfaces/healthConnect';
import type { PersistedSession } from '@/interfaces/session';
import { writeSessionToHealthConnect } from '@/services/healthConnect/writeSessionToHealthConnect';

interface SyncInfo {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
}

function deriveInitialState(session: PersistedSession | null): SyncInfo {
  if (session?.healthConnect?.state === 'synced') {
    return {
      state: 'synced',
      reason: null,
      syncedAt: session.healthConnect.syncedAt ?? null,
    };
  }
  if (session?.healthConnect?.state === 'abandoned') {
    return {
      state: 'abandoned',
      reason: session.healthConnect.reason ?? null,
      syncedAt: null,
    };
  }
  if (session?.healthConnect?.state === 'failed') {
    return {
      state: 'failed',
      reason: session.healthConnect.reason ?? null,
      syncedAt: null,
    };
  }
  return {
    state: 'unsynced',
    reason: null,
    syncedAt: null,
  };
}

export function useHealthConnectSessionSync(
  session: PersistedSession | null,
  options?: { title?: string },
): {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  retry: () => void;
} {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(() =>
    deriveInitialState(session),
  );
  const isMountedRef = useRef(true);

  // Sync state whenever the viewed session changes
  useEffect(() => {
    setSyncInfo(deriveInitialState(session));
  }, [session]);

  const performSync = useCallback(
    async (
      targetSession: PersistedSession,
      syncOptions?: { manual?: boolean },
    ) => {
      setSyncInfo({
        state: 'syncing',
        reason: null,
        syncedAt: null,
      });

      const result = await writeSessionToHealthConnect(targetSession, {
        title: options?.title,
        manual: syncOptions?.manual,
      });

      // Unmount guard
      if (!isMountedRef.current) {
        return;
      }

      if (result.status === 'synced' || result.status === 'already-synced') {
        setSyncInfo({
          state: 'synced',
          reason: null,
          syncedAt: result.sync.syncedAt ?? null,
        });
      } else {
        setSyncInfo({
          state: result.sync.state === 'abandoned' ? 'abandoned' : 'failed',
          reason: result.sync.reason ?? null,
          syncedAt: null,
        });
      }
    },
    [options?.title],
  );

  // Auto-attempt sync on mount ONLY if this session has never been synced
  useEffect(() => {
    isMountedRef.current = true;

    if (session && !session.healthConnect) {
      performSync(session);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [session, performSync]);

  const retry = useCallback(() => {
    if (
      !session ||
      syncInfo.state === 'syncing' ||
      syncInfo.state === 'synced'
    ) {
      return;
    }
    performSync(session, { manual: true });
  }, [session, syncInfo.state, performSync]);

  return {
    state: syncInfo.state,
    reason: syncInfo.reason,
    syncedAt: syncInfo.syncedAt,
    retry,
  };
}
