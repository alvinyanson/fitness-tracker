import type { WorkoutSessionSnapshot } from '@/interfaces/session';

/** Elapsed active time in ms, excluding every paused span. */
export function getElapsedMs(
  session: WorkoutSessionSnapshot,
  now: number,
): number {
  switch (session.status) {
    case 'idle':
      return 0;
    case 'stopped':
      return session.stoppedElapsedMs ?? 0;
    case 'active':
      if (session.startedAt === null) {
        return 0;
      }
      return now - session.startedAt - session.totalPausedMs;
    case 'paused':
      if (session.pausedAt === null || session.startedAt === null) {
        return 0;
      }
      return session.pausedAt - session.startedAt - session.totalPausedMs;
  }
}
