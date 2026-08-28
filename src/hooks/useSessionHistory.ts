import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { SessionIndexEntry } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import {
  deleteSession,
  getSessionIndex,
} from '@/services/storage/sessionHistoryStorage';

export interface SessionHistory {
  entries: SessionIndexEntry[];
  refresh: () => void;
  remove: (id: string) => void;
}

function readIndex(): SessionIndexEntry[] {
  try {
    return getSessionIndex();
  } catch (error) {
    reportError(error, { scope: 'useSessionHistory.getSessionIndex' });
    return [];
  }
}

/** Session index read/refresh/delete, so the list body can live in `components/`. */
export function useSessionHistory(): SessionHistory {
  const [entries, setEntries] = useState<SessionIndexEntry[]>(readIndex);

  const refresh = useCallback(() => {
    setEntries(readIndex());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setEntries(readIndex());
    }, []),
  );

  const remove = useCallback((id: string) => {
    try {
      deleteSession(id);
    } catch (error) {
      reportError(error, { scope: 'useSessionHistory.deleteSession', id });
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return { entries, refresh, remove };
}
