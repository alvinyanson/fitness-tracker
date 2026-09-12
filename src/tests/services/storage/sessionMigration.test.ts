import { createMMKV } from 'react-native-mmkv';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import * as crashService from '@/services/crashService';
import { getItem, setItem } from '@/services/storage/mmkvStorage';
import {
  LEGACY_SESSION_INDEX_KEY,
  LEGACY_SESSION_PREFIX,
  SESSION_MIGRATION_FLAG_KEY,
  migrateSessionsToSqlite,
} from '@/services/storage/sessionMigration';
import {
  getSession,
  getSessionIndex,
} from '@/services/storage/sessionHistoryStorage';
import { resetDatabaseForTests } from '@/services/storage/sqliteDatabase';

describe('sessionMigration', () => {
  let reportErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    createMMKV().clearAll();
    resetDatabaseForTests();
    jest.clearAllMocks();
    reportErrorSpy = jest.spyOn(crashService, 'reportError');
  });

  afterEach(() => {
    reportErrorSpy.mockRestore();
    resetDatabaseForTests();
  });

  const sessionA: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1000',
    startedAt: 1000,
    endedAt: 61000,
    stats: {
      durationMs: 60000,
      avgHr: 140,
      maxHr: 160,
      minHr: 120,
      sampleCount: 2,
      rawSampleCount: 2,
    },
    samples: [
      { timestamp: 1000, bpm: 120, sensorContact: 'contactDetected' },
      { timestamp: 61000, bpm: 160, sensorContact: 'contactDetected' },
    ],
  };

  const sessionB: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '2000',
    startedAt: 2000,
    endedAt: 122000,
    stats: {
      durationMs: 120000,
      avgHr: 150,
      maxHr: 170,
      minHr: 130,
      sampleCount: 1,
      rawSampleCount: 1,
    },
    samples: [{ timestamp: 2000, bpm: 150, sensorContact: 'contactDetected' }],
  };

  it('migrates seeded MMKV sessions with stats and samples intact and leaves MMKV keys untouched', () => {
    // Seed MMKV
    setItem(LEGACY_SESSION_INDEX_KEY, [
      {
        id: '2000',
        startedAt: 2000,
        endedAt: 122000,
        durationMs: 120000,
        avgHr: 150,
      },
      {
        id: '1000',
        startedAt: 1000,
        endedAt: 61000,
        durationMs: 60000,
        avgHr: 140,
      },
    ]);
    setItem(`${LEGACY_SESSION_PREFIX}1000`, sessionA);
    setItem(`${LEGACY_SESSION_PREFIX}2000`, sessionB);

    const result = migrateSessionsToSqlite();
    expect(result).toEqual({ migrated: 2, skipped: 0 });

    // Assert SQLite has both sessions
    expect(getSession('1000')).toEqual(sessionA);
    expect(getSession('2000')).toEqual(sessionB);

    const index = getSessionIndex();
    expect(index.map((i) => i.id)).toEqual(['2000', '1000']);

    // Assert MMKV keys still exist and are untouched
    expect(getItem(`${LEGACY_SESSION_PREFIX}1000`)).toEqual(sessionA);
    expect(getItem(`${LEGACY_SESSION_PREFIX}2000`)).toEqual(sessionB);
    expect(getItem(LEGACY_SESSION_INDEX_KEY)).toHaveLength(2);
    expect(getItem(SESSION_MIGRATION_FLAG_KEY)).toBe('done');
  });

  it('is idempotent: calling twice migrates sessions once and second call returns migrated: 0', () => {
    setItem(LEGACY_SESSION_INDEX_KEY, [
      {
        id: '1000',
        startedAt: 1000,
        endedAt: 61000,
        durationMs: 60000,
        avgHr: 140,
      },
    ]);
    setItem(`${LEGACY_SESSION_PREFIX}1000`, sessionA);

    const firstResult = migrateSessionsToSqlite();
    expect(firstResult).toEqual({ migrated: 1, skipped: 0 });

    const secondResult = migrateSessionsToSqlite();
    expect(secondResult).toEqual({ migrated: 0, skipped: 0 });

    expect(getSessionIndex()).toHaveLength(1);
    expect(getSession('1000')).toEqual(sessionA);
  });

  it('skips corrupt or missing blob, reports error, and migrates valid siblings', () => {
    setItem(LEGACY_SESSION_INDEX_KEY, [
      {
        id: '2000',
        startedAt: 2000,
        endedAt: 122000,
        durationMs: 120000,
        avgHr: 150,
      },
      {
        id: 'corrupt-1',
        startedAt: 1500,
        endedAt: 61500,
        durationMs: 60000,
        avgHr: null,
      },
      {
        id: '1000',
        startedAt: 1000,
        endedAt: 61000,
        durationMs: 60000,
        avgHr: 140,
      },
    ]);

    setItem(`${LEGACY_SESSION_PREFIX}1000`, sessionA);
    // corrupt-1 blob missing or invalid JSON
    createMMKV().set(`${LEGACY_SESSION_PREFIX}corrupt-1`, 'invalid-json{{');
    setItem(`${LEGACY_SESSION_PREFIX}2000`, sessionB);

    const result = migrateSessionsToSqlite();
    expect(result).toEqual({ migrated: 2, skipped: 1 });

    expect(reportErrorSpy).toHaveBeenCalled();
    expect(getSession('1000')).toEqual(sessionA);
    expect(getSession('2000')).toEqual(sessionB);
    expect(getSession('corrupt-1')).toBeNull();
  });

  it('skips sessions that are already present in SQLite without overwriting', () => {
    setItem(LEGACY_SESSION_INDEX_KEY, [
      {
        id: '1000',
        startedAt: 1000,
        endedAt: 61000,
        durationMs: 60000,
        avgHr: 140,
      },
      {
        id: '2000',
        startedAt: 2000,
        endedAt: 122000,
        durationMs: 120000,
        avgHr: 150,
      },
    ]);
    setItem(`${LEGACY_SESSION_PREFIX}1000`, sessionA);
    setItem(`${LEGACY_SESSION_PREFIX}2000`, sessionB);

    // Pre-insert sessionA into SQLite with different stats
    const modifiedA: PersistedSession = {
      ...sessionA,
      stats: { ...sessionA.stats, avgHr: 199 },
    };
    const {
      saveSession: preSave,
    } = require('@/services/storage/sessionHistoryStorage');
    preSave(modifiedA);

    const result = migrateSessionsToSqlite();
    expect(result).toEqual({ migrated: 1, skipped: 1 });

    // sessionA should retain modified stats (not overwritten)
    expect(getSession('1000')?.stats.avgHr).toBe(199);
    expect(getSession('2000')).toEqual(sessionB);
  });
});
