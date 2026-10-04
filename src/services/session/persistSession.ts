import type {
  PersistedSession,
  WorkoutSessionSnapshot,
} from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { calculateRouteDistance } from '@/services/location/distanceMath';
import { computeSessionStats } from '@/services/session/sessionStats';
import { saveSession } from '@/services/storage/sessionHistoryStorage';

/** Caller must pass a session already in `'stopped'` status. */
export function persistCompletedSession(
  session: WorkoutSessionSnapshot,
): PersistedSession {
  const stats = computeSessionStats(session);
  const startedAt = session.startedAt!;
  const distanceMeters =
    session.routePoints && session.routePoints.length > 0
      ? calculateRouteDistance(session.routePoints)
      : null;

  const record: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: String(startedAt),
    startedAt,
    endedAt: startedAt + stats.durationMs,
    stats: {
      ...stats,
      distanceMeters,
    },
    samples: session.samples,
    ...(session.routePoints && session.routePoints.length > 0
      ? { routePoints: session.routePoints }
      : {}),
  };

  saveSession(record);
  return record;
}
