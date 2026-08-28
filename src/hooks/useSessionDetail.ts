import { useCallback, useMemo } from 'react';
import type { PersistedSession } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import {
  deleteSession,
  getSession,
} from '@/services/storage/sessionHistoryStorage';

export interface SessionDetail {
  session: PersistedSession | null;
  remove: () => void;
}

/** Single-session read/delete, so the summary body can live in `components/`. */
export function useSessionDetail(id: string | null): SessionDetail {
  const session = useMemo(() => {
    if (!id) {
      return null;
    }
    try {
      return getSession(id);
    } catch (error) {
      reportError(error, { scope: 'useSessionDetail.getSession', id });
      return null;
    }
  }, [id]);

  const remove = useCallback(() => {
    if (!id) {
      return;
    }
    try {
      deleteSession(id);
    } catch (error) {
      reportError(error, { scope: 'useSessionDetail.deleteSession', id });
    }
  }, [id]);

  return { session, remove };
}
