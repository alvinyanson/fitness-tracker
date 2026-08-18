import { createMMKV } from 'react-native-mmkv';
import {
  saveSession,
  getSession,
  getSessionIndex,
  deleteSession,
  updateSessionHealthConnect,
} from '@/services/storage/sessionHistoryStorage';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import type { SessionHealthConnectSync } from '@/interfaces/healthConnect';

describe('sessionHistoryStorage', () => {
  beforeEach(() => {
    createMMKV().clearAll();
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
    },
    samples: [],
  };

  it('returns null when getting a missing session id', () => {
    expect(getSession('non-existent')).toBeNull();
  });

  it('returns empty array when session index is empty', () => {
    expect(getSessionIndex()).toEqual([]);
  });

  it('saves and retrieves a session by id', () => {
    saveSession(mockSession1);
    expect(getSession('1000')).toEqual(mockSession1);
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

  it('overwrites existing session entry gracefully if saved again', () => {
    saveSession(mockSession1);
    const updatedSession1: PersistedSession = {
      ...mockSession1,
      stats: { ...mockSession1.stats, avgHr: 145 },
    };
    saveSession(updatedSession1);

    expect(getSession('1000')).toEqual(updatedSession1);
    const index = getSessionIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.avgHr).toBe(145);
  });

  it('deletes a session and removes it from index', () => {
    saveSession(mockSession1);
    saveSession(mockSession2);

    deleteSession('1000');

    expect(getSession('1000')).toBeNull();
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

    it('updates healthConnect field on stored session and leaves index untouched', () => {
      saveSession(mockSession1);
      const indexBefore = getSessionIndex();

      const sync: SessionHealthConnectSync = {
        state: 'synced',
        attemptedAt: 65000,
        syncedAt: 65000,
        exerciseRecordId: 'rec-1000',
      };

      const result = updateSessionHealthConnect('1000', sync);

      expect(result).toEqual({
        ...mockSession1,
        healthConnect: sync,
      });

      expect(getSession('1000')).toEqual({
        ...mockSession1,
        healthConnect: sync,
      });

      const indexAfter = getSessionIndex();
      expect(indexAfter).toEqual(indexBefore);
    });
  });
});
