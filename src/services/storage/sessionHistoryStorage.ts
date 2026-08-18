import type { SessionHealthConnectSync } from '@/interfaces/healthConnect';
import type { PersistedSession, SessionIndexEntry } from '@/interfaces/session';
import { getItem, setItem, removeItem } from '@/services/storage/mmkvStorage';

const SESSION_KEY_PREFIX = '@fitness_tracker/session/';
const SESSION_INDEX_KEY = '@fitness_tracker/session-index';

export function saveSession(session: PersistedSession): void {
  setItem(`${SESSION_KEY_PREFIX}${session.id}`, session);

  const currentIndex = getSessionIndex();
  const filtered = currentIndex.filter((entry) => entry.id !== session.id);
  const newEntry: SessionIndexEntry = {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.stats.durationMs,
    avgHr: session.stats.avgHr,
  };

  filtered.push(newEntry);
  filtered.sort((a, b) => b.startedAt - a.startedAt);

  setItem(SESSION_INDEX_KEY, filtered);
}

export function getSession(id: string): PersistedSession | null {
  return getItem<PersistedSession>(`${SESSION_KEY_PREFIX}${id}`);
}

export function getSessionIndex(): SessionIndexEntry[] {
  return getItem<SessionIndexEntry[]>(SESSION_INDEX_KEY) ?? [];
}

export function deleteSession(id: string): void {
  removeItem(`${SESSION_KEY_PREFIX}${id}`);

  const currentIndex = getSessionIndex();
  const updatedIndex = currentIndex.filter((entry) => entry.id !== id);
  setItem(SESSION_INDEX_KEY, updatedIndex);
}

export function updateSessionHealthConnect(
  id: string,
  sync: SessionHealthConnectSync,
): PersistedSession | null {
  const session = getSession(id);
  if (!session) {
    return null;
  }

  const updatedSession: PersistedSession = {
    ...session,
    healthConnect: sync,
  };

  setItem(`${SESSION_KEY_PREFIX}${id}`, updatedSession);
  return updatedSession;
}
