import type {
  PersistedSession,
  WorkoutSessionSnapshot,
} from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { computeSessionStats } from '@/services/session/sessionStats';
import { saveSession } from '@/services/storage/sessionHistoryStorage';

/** Caller must pass a session already in `'stopped'` status. */
export function persistCompletedSession(
  session: WorkoutSessionSnapshot,
): PersistedSession {
  const stats = computeSessionStats(session);
  const startedAt = session.startedAt!;

  const record: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: String(startedAt),
    startedAt,
    endedAt: startedAt + stats.durationMs,
    stats,
    samples: session.samples,
  };

  saveSession(record);
  return record;
}
