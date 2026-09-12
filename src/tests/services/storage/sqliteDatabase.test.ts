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

  it('fresh open creates all three tables, indexes, and sets user_version = 1', () => {
    const db = getDatabase();

    const versionRow = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(versionRow?.user_version).toBe(SCHEMA_VERSION);

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
  });

  it('second open is a no-op and returns the same memoized database handle', () => {
    const db1 = getDatabase();
    const db2 = getDatabase();
    expect(db2).toBe(db1);
  });

  it('reports and leaves schema untouched when user_version is higher than SCHEMA_VERSION', () => {
    // Directly pre-set user_version higher than SCHEMA_VERSION
    const rawDb = openDatabaseSync(DATABASE_NAME);
    rawDb.execSync('PRAGMA user_version = 2');

    const db = getDatabase();

    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        scope: 'sqliteDatabase.migration',
        currentVersion: '2',
        schemaVersion: String(SCHEMA_VERSION),
      }),
    );

    const versionRow = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(versionRow?.user_version).toBe(2);

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
