import {
  deleteSession,
  getHrSampleCount,
  getHrSamples,
  getRoutePointCount,
  getRoutePoints,
  getSession,
  getSessionIndex,
  getSessionRecord,
  saveSession,
  updateSessionHealthConnect,
} from '@/services/storage/sessionHistoryStorage';
import { resetDatabaseForTests } from '@/services/storage/sqliteDatabase';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import type { SessionHealthConnectSync } from '@/interfaces/healthConnect';
import type { RoutePoint } from '@/interfaces/location';

describe('sessionHistoryStorage', () => {
  beforeEach(() => {
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
  });

  const mockSession1: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1000',
    startedAt: 1000,
    endedAt: 61000,
    stats: {
      durationMs: 60000,
      avgHr: 140,
      maxHr: 160,
      minHr: 120,
      sampleCount: 60,
      rawSampleCount: 60,
      distanceMeters: null,
    },
    samples: [
      { timestamp: 1000, bpm: 120, sensorContact: 'contactDetected' },
      { timestamp: 61000, bpm: 160, sensorContact: 'contactDetected' },
    ],
  };

  const mockSession2: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '2000',
    startedAt: 2000,
    endedAt: 122000,
    stats: {
      durationMs: 120000,
      avgHr: 150,
      maxHr: 170,
      minHr: 130,
      sampleCount: 120,
      rawSampleCount: 120,
      distanceMeters: null,
    },
    samples: [],
  };

  it('returns null when getting a missing session id', () => {
    expect(getSession('non-existent')).toBeNull();
    expect(getSessionRecord('non-existent')).toBeNull();
  });

  it('returns empty array when session index is empty', () => {
    expect(getSessionIndex()).toEqual([]);
  });

  it('saves and retrieves a session by id', () => {
    saveSession(mockSession1);
    expect(getSession('1000')).toEqual(mockSession1);
  });

  it('retrieves session record without samples via getSessionRecord', () => {
    saveSession(mockSession1);
    const { samples: _samples, ...expectedRecord } = mockSession1;
    expect(getSessionRecord('1000')).toEqual(expectedRecord);
  });

  it('preserves optional rrIntervals and energyExpended on save and read round-trip', () => {
    const sessionWithExtras: PersistedSession = {
      ...mockSession1,
      id: 'extras-1',
      samples: [
        {
          timestamp: 1000,
          bpm: 125,
          sensorContact: 'contactDetected',
          energyExpended: 12.5,
          rrIntervals: [820, 830],
        },
      ],
    };
    saveSession(sessionWithExtras);
    expect(getSession('extras-1')).toEqual(sessionWithExtras);
  });

  it('indexes saved sessions ordered newest-first', () => {
    saveSession(mockSession1);
    saveSession(mockSession2);

    const index = getSessionIndex();
    expect(index).toHaveLength(2);
    expect(index[0]).toEqual({
      id: '2000',
      startedAt: 2000,
      endedAt: 122000,
      durationMs: 120000,
      avgHr: 150,
    });
    expect(index[1]).toEqual({
      id: '1000',
      startedAt: 1000,
      endedAt: 61000,
      durationMs: 60000,
      avgHr: 140,
    });
  });

  it('overwrites existing session entry and replaces samples series when saved again', () => {
    saveSession(mockSession1);
    expect(getHrSampleCount('1000')).toBe(2);

    const updatedSession1: PersistedSession = {
      ...mockSession1,
      stats: { ...mockSession1.stats, avgHr: 145 },
      samples: [
        { timestamp: 1000, bpm: 145, sensorContact: 'contactDetected' },
      ],
    };
    saveSession(updatedSession1);

    expect(getSession('1000')).toEqual(updatedSession1);
    expect(getHrSampleCount('1000')).toBe(1);

    const index = getSessionIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.avgHr).toBe(145);
  });

  it('deletes a session, removes it from index, and cascades sample deletion', () => {
    saveSession(mockSession1);
    saveSession(mockSession2);
    expect(getHrSampleCount('1000')).toBe(2);

    deleteSession('1000');

    expect(getSession('1000')).toBeNull();
    expect(getSessionRecord('1000')).toBeNull();
    expect(getHrSampleCount('1000')).toBe(0);
    expect(getHrSamples('1000')).toEqual([]);
    expect(getSession('2000')).toEqual(mockSession2);

    const index = getSessionIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.id).toBe('2000');
  });

  it('does not throw when deleting a non-existent session', () => {
    expect(() => deleteSession('9999')).not.toThrow();
  });

  describe('updateSessionHealthConnect', () => {
    it('returns null when attempting to update a missing session', () => {
      const sync: SessionHealthConnectSync = {
        state: 'synced',
        attemptedAt: 5000,
        syncedAt: 5000,
        exerciseRecordId: 'rec-123',
      };

      const result = updateSessionHealthConnect('missing-id', sync);
      expect(result).toBeNull();
    });

    it('updates healthConnect field on stored session and reflects on index and record reads', () => {
      saveSession(mockSession1);

      const sync: SessionHealthConnectSync = {
        state: 'synced',
        attemptedAt: 65000,
        syncedAt: 65000,
        exerciseRecordId: 'rec-1000',
      };

      const result = updateSessionHealthConnect('1000', sync);

      const { samples: _samples, ...expectedRecord } = mockSession1;
      expect(result).toEqual({
        ...expectedRecord,
        healthConnect: sync,
      });

      expect(getSession('1000')).toEqual({
        ...mockSession1,
        healthConnect: sync,
      });

      expect(getSessionRecord('1000')).toEqual({
        ...expectedRecord,
        healthConnect: sync,
      });

      const indexAfter = getSessionIndex();
      expect(indexAfter[0]?.healthConnect).toEqual(sync);
    });
  });

  describe('route points persistence and querying', () => {
    const mockRoutePoints: RoutePoint[] = [
      {
        timestamp: 1000,
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 12.3,
        accuracy: 4.5,
      },
      {
        timestamp: 3000,
        latitude: 37.7752,
        longitude: -122.4188,
        altitude: 13.0,
        accuracy: 5.0,
      },
      {
        timestamp: 5000,
        latitude: 37.7755,
        longitude: -122.4182,
        altitude: null,
        accuracy: null,
      },
    ];

    const sessionWithRoute: PersistedSession = {
      ...mockSession1,
      id: 'session-with-route',
      stats: {
        ...mockSession1.stats,
        distanceMeters: 250.5,
      },
      routePoints: mockRoutePoints,
    };

    it('saves and retrieves route points in seq order via getRoutePoints', () => {
      saveSession(sessionWithRoute);

      expect(getRoutePointCount('session-with-route')).toBe(3);
      const points = getRoutePoints('session-with-route');
      expect(points).toEqual(mockRoutePoints);
    });

    it('returns empty array and 0 count for session with no route points', () => {
      saveSession(mockSession1);

      expect(getRoutePointCount('1000')).toBe(0);
      expect(getRoutePoints('1000')).toEqual([]);
    });

    it('attaches route points to full session returned by getSession', () => {
      saveSession(sessionWithRoute);

      const retrieved = getSession('session-with-route');
      expect(retrieved?.routePoints).toEqual(mockRoutePoints);
      expect(retrieved?.stats.distanceMeters).toBe(250.5);
    });

    it('includes distanceMeters on getSessionRecord and getSessionIndex', () => {
      saveSession(sessionWithRoute);

      const record = getSessionRecord('session-with-route');
      expect(record?.stats.distanceMeters).toBe(250.5);

      const index = getSessionIndex();
      const entry = index.find((e) => e.id === 'session-with-route');
      expect(entry?.distanceMeters).toBe(250.5);
    });

    it('replaces existing route points on subsequent saveSession call', () => {
      saveSession(sessionWithRoute);
      expect(getRoutePointCount('session-with-route')).toBe(3);

      const updatedPoints: RoutePoint[] = [
        {
          timestamp: 10000,
          latitude: 37.78,
          longitude: -122.41,
          altitude: 15,
          accuracy: 3,
        },
      ];

      saveSession({
        ...sessionWithRoute,
        routePoints: updatedPoints,
      });

      expect(getRoutePointCount('session-with-route')).toBe(1);
      expect(getRoutePoints('session-with-route')).toEqual(updatedPoints);
    });

    it('cascades deletion of route points when session is deleted', () => {
      saveSession(sessionWithRoute);
      expect(getRoutePointCount('session-with-route')).toBe(3);

      deleteSession('session-with-route');

      expect(getSession('session-with-route')).toBeNull();
      expect(getRoutePoints('session-with-route')).toEqual([]);
      expect(getRoutePointCount('session-with-route')).toBe(0);
    });
  });
});
