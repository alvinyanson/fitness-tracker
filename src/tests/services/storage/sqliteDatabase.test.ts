import { openDatabaseSync } from 'expo-sqlite';
import * as crashService from '@/services/crashService';
import {
  DATABASE_NAME,
  SCHEMA_VERSION,
  getDatabase,
  resetDatabaseForTests,
} from '@/services/storage/sqliteDatabase';

describe('sqliteDatabase', () => {
  let reportErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    resetDatabaseForTests();
    jest.clearAllMocks();
    reportErrorSpy = jest.spyOn(crashService, 'reportError');
  });

  afterEach(() => {
    reportErrorSpy.mockRestore();
    resetDatabaseForTests();
  });

  it('fresh open creates all three tables, indexes, distance_meters column, and sets user_version = 2', () => {
    const db = getDatabase();

    const versionRow = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(versionRow?.user_version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);

    const tables = db
      .getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      )
      .map((r) => r.name);

    expect(tables).toContain('sessions');
    expect(tables).toContain('hr_samples');
    expect(tables).toContain('route_points');

    const indexes = db
      .getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      )
      .map((r) => r.name);

    expect(indexes).toContain('idx_sessions_started_at');
    expect(indexes).toContain('idx_hr_samples_session_time');
    expect(indexes).toContain('idx_route_points_session_time');

    const columns = db
      .getAllSync<{ name: string }>('PRAGMA table_info(sessions)')
      .map((c) => c.name);
    expect(columns).toContain('distance_meters');
  });

  it('second open is a no-op and returns the same memoized database handle', () => {
    const db1 = getDatabase();
    const db2 = getDatabase();
    expect(db2).toBe(db1);
  });

  it('migrates an existing version 1 database to version 2 without losing data', () => {
    // 1. Manually set up a v1 database
    const rawDb = openDatabaseSync(DATABASE_NAME);
    rawDb.execSync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id             TEXT PRIMARY KEY NOT NULL,
        schema_version INTEGER NOT NULL,
        started_at     INTEGER NOT NULL,
        ended_at       INTEGER NOT NULL,
        duration_ms    INTEGER NOT NULL,
        avg_hr         INTEGER,
        max_hr         INTEGER,
        min_hr         INTEGER,
        sample_count     INTEGER NOT NULL,
        raw_sample_count INTEGER NOT NULL,
        health_connect TEXT
      );
      PRAGMA user_version = 1;
    `);

    rawDb.runSync(
      `INSERT INTO sessions (
        id, schema_version, started_at, ended_at, duration_ms,
        avg_hr, max_hr, min_hr, sample_count, raw_sample_count, health_connect
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['v1_session_1', 1, 1000, 2000, 1000, 140, 160, 120, 10, 10, null],
    );

    // 2. Open via getDatabase() which triggers migrateDatabase
    const db = getDatabase();

    const versionRow = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(versionRow?.user_version).toBe(2);

    const columns = db
      .getAllSync<{ name: string }>('PRAGMA table_info(sessions)')
      .map((c) => c.name);
    expect(columns).toContain('distance_meters');

    const session = db.getFirstSync<{
      id: string;
      avg_hr: number;
      distance_meters: number | null;
    }>('SELECT id, avg_hr, distance_meters FROM sessions WHERE id = ?', [
      'v1_session_1',
    ]);
    expect(session).toEqual({
      id: 'v1_session_1',
      avg_hr: 140,
      distance_meters: null,
    });
  });

  it('reports and leaves schema untouched when user_version is higher than SCHEMA_VERSION', () => {
    // Directly pre-set user_version higher than SCHEMA_VERSION
    const rawDb = openDatabaseSync(DATABASE_NAME);
    rawDb.execSync('PRAGMA user_version = 3');

    const db = getDatabase();

    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        scope: 'sqliteDatabase.migration',
        currentVersion: '3',
        schemaVersion: String(SCHEMA_VERSION),
      }),
    );

    const versionRow = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(versionRow?.user_version).toBe(3);

    // Schema tables should NOT have been created by migration
    const tables = db
      .getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      )
      .map((r) => r.name);

    expect(tables).not.toContain('sessions');
    expect(tables).not.toContain('hr_samples');
    expect(tables).not.toContain('route_points');
  });

  it('wraps and rethrows open/migration failures reporting through crashService', () => {
    const rawDb = openDatabaseSync(DATABASE_NAME);
    jest.spyOn(rawDb, 'execSync').mockImplementationOnce(() => {
      throw new Error('Disk I/O error');
    });

    expect(() => getDatabase()).toThrow('Disk I/O error');
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        scope: 'sqliteDatabase.getDatabase',
      }),
    );
  });
});
