import { create } from 'zustand';
import type {
  HealthConnectFlushResult,
  HealthConnectSyncQueueSummary,
} from '@/interfaces/healthConnect';
import {
  flushPendingSessions,
  getSyncQueueSummary,
} from '@/services/healthConnect/pendingSessionSync';

export interface HealthConnectSyncQueueState {
  status: 'idle' | 'flushing';
  summary: HealthConnectSyncQueueSummary;
  lastResult: HealthConnectFlushResult | null;
  refresh: () => void;
  flush: (options?: { title?: string; manual?: boolean }) => Promise<void>;
}

export const useHealthConnectSyncStore = create<HealthConnectSyncQueueState>(
  (set, get) => ({
    status: 'idle',
    summary: getSyncQueueSummary(),
    lastResult: null,
    refresh: () => {
      set({ summary: getSyncQueueSummary() });
    },
    flush: async (options) => {
      if (get().status === 'flushing') {
        return;
      }
      set({ status: 'flushing' });
      try {
        const result = await flushPendingSessions(options);
        set({
          status: 'idle',
          lastResult: result,
          summary: getSyncQueueSummary(),
        });
      } finally {
        set({
          status: 'idle',
          summary: getSyncQueueSummary(),
        });
      }
    },
  }),
);
