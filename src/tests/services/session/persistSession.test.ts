import { createMMKV } from 'react-native-mmkv';
import { persistCompletedSession } from '@/services/session/persistSession';
import { getSession } from '@/services/storage/sessionHistoryStorage';
import {
  WorkoutSessionSnapshot,
  SESSION_SCHEMA_VERSION,
} from '@/interfaces/session';

describe('persistCompletedSession', () => {
  beforeEach(() => {
    createMMKV().clearAll();
  });

  it('persists a completed session with valid HR samples and returns the record', () => {
    const snapshot: WorkoutSessionSnapshot = {
      status: 'stopped',
      reconnecting: false,
      startedAt: 100000,
      pausedAt: null,
      totalPausedMs: 0,
      stoppedElapsedMs: 60000,
      samples: [
        { timestamp: 100000, bpm: 120, sensorContact: 'contactDetected' },
        { timestamp: 130000, bpm: 140, sensorContact: 'contactDetected' },
        { timestamp: 160000, bpm: 160, sensorContact: 'contactDetected' },
      ],
      routePoints: [],
    };

    const record = persistCompletedSession(snapshot);

    expect(record).toEqual({
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: '100000',
      startedAt: 100000,
      endedAt: 160000,
      stats: {
        durationMs: 60000,
        avgHr: 140,
        maxHr: 160,
        minHr: 120,
        sampleCount: 3,
        rawSampleCount: 3,
        distanceMeters: null,
      },
      samples: snapshot.samples,
    });

    expect(record.endedAt - record.startedAt).toBe(record.stats.durationMs);

    const stored = getSession('100000');
    expect(stored).toEqual(record);
  });

  it('persists a session with no HR samples cleanly', () => {
    const snapshot: WorkoutSessionSnapshot = {
      status: 'stopped',
      reconnecting: false,
      startedAt: 200000,
      pausedAt: null,
      totalPausedMs: 0,
      stoppedElapsedMs: 45000,
      samples: [],
      routePoints: [],
    };

    const record = persistCompletedSession(snapshot);

    expect(record.id).toBe('200000');
    expect(record.stats.avgHr).toBeNull();
    expect(record.stats.maxHr).toBeNull();
    expect(record.stats.minHr).toBeNull();
    expect(record.stats.sampleCount).toBe(0);
    expect(record.stats.durationMs).toBe(45000);
    expect(record.stats.distanceMeters).toBeNull();
    expect(record.endedAt).toBe(245000);

    const stored = getSession('200000');
    expect(stored).toEqual(record);
  });

  it('persists a completed session with route points and computes distanceMeters', () => {
    const snapshot: WorkoutSessionSnapshot = {
      status: 'stopped',
      reconnecting: false,
      startedAt: 300000,
      pausedAt: null,
      totalPausedMs: 0,
      stoppedElapsedMs: 120000,
      samples: [],
      routePoints: [
        {
          timestamp: 300000,
          latitude: 0,
          longitude: 0,
          altitude: null,
          accuracy: 5,
        },
        {
          timestamp: 305000,
          latitude: 0,
          longitude: 0.01,
          altitude: null,
          accuracy: 5,
        },
      ],
    };

    const record = persistCompletedSession(snapshot);

    expect(record.id).toBe('300000');
    expect(record.stats.distanceMeters).toBeGreaterThan(1100);
    expect(record.stats.distanceMeters).toBeLessThan(1120);
    expect(record.routePoints).toEqual(snapshot.routePoints);

    const stored = getSession('300000');
    expect(stored).toEqual(record);
  });
});
