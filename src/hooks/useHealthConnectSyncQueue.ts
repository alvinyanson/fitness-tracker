import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type {
  HealthConnectFlushResult,
  HealthConnectSyncQueueSummary,
} from '@/interfaces/healthConnect';
import { useHealthConnectSyncStore } from '@/store/healthConnectSyncStore';

export function useHealthConnectSyncQueue(options?: {
  /** Mount the AppState listener. Exactly one call site should pass `true`. */
  autoFlushOnForeground?: boolean;
  title?: string;
}): {
  status: 'idle' | 'flushing';
  summary: HealthConnectSyncQueueSummary;
  lastResult: HealthConnectFlushResult | null;
  syncNow: () => void;
  refresh: () => void;
} {
  const autoFlushOnForeground = options?.autoFlushOnForeground ?? false;
  const title = options?.title;

  const status = useHealthConnectSyncStore((state) => state.status);
  const summary = useHealthConnectSyncStore((state) => state.summary);
  const lastResult = useHealthConnectSyncStore((state) => state.lastResult);
  const refresh = useHealthConnectSyncStore((state) => state.refresh);
  const flush = useHealthConnectSyncStore((state) => state.flush);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoFlushOnForeground) {
      return;
    }

    // Auto-flush on mount (cold start is a foreground)
    flush({ manual: false, title });

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (appStateRef.current !== 'active' && nextAppState === 'active') {
          flush({ manual: false, title });
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [autoFlushOnForeground, title, flush]);

  const syncNow = useCallback(() => {
    flush({ manual: true, title });
  }, [flush, title]);

  return {
    status,
    summary,
    lastResult,
    syncNow,
    refresh,
  };
}
