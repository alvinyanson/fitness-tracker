import { getElapsedMs } from '@/services/session/sessionElapsed';
import type { WorkoutSessionSnapshot } from '@/interfaces/session';

describe('getElapsedMs', () => {
  const baseSnapshot: WorkoutSessionSnapshot = {
    status: 'idle',
    reconnecting: false,
    startedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    stoppedElapsedMs: null,
    samples: [],
  };

  it('returns 0 when status is idle', () => {
    const session: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'idle',
    };
    expect(getElapsedMs(session, 10000)).toBe(0);
  });

  it('returns stoppedElapsedMs (or 0 if null) when status is stopped', () => {
    const sessionWithElapsed: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'stopped',
      stoppedElapsedMs: 45000,
    };
    expect(getElapsedMs(sessionWithElapsed, 999999)).toBe(45000);

    const sessionNullElapsed: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'stopped',
      stoppedElapsedMs: null,
    };
    expect(getElapsedMs(sessionNullElapsed, 999999)).toBe(0);
  });

  it('calculates elapsed time when active', () => {
    const session: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'active',
      startedAt: 1000,
      totalPausedMs: 0,
    };
    expect(getElapsedMs(session, 6000)).toBe(5000);
  });

  it('excludes totalPausedMs correctly when active after completed pause spans', () => {
    const session: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'active',
      startedAt: 1000,
      totalPausedMs: 30000,
    };
    expect(getElapsedMs(session, 100000)).toBe(69000);
  });

  it('calculates frozen elapsed time when paused, ignoring now', () => {
    const session: WorkoutSessionSnapshot = {
      ...baseSnapshot,
      status: 'paused',
      startedAt: 1000,
      pausedAt: 10000,
      totalPausedMs: 2000,
    };
    expect(getElapsedMs(session, 999999)).toBe(7000);
  });
});
