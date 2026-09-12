import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { reportError } from '@/services/crashService';

export const DATABASE_NAME = 'fitness-tracker.db';
export const SCHEMA_VERSION = 1;

let dbHandle: SQLiteDatabase | null = null;

const MIGRATION_1_DDL = `
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
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS hr_samples (
  session_id      TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  timestamp       INTEGER NOT NULL,
  bpm             INTEGER NOT NULL,
  sensor_contact  TEXT NOT NULL,
  energy_expended REAL,
  rr_intervals    TEXT,
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_hr_samples_session_time ON hr_samples (session_id, timestamp);

CREATE TABLE IF NOT EXISTS route_points (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  timestamp  INTEGER NOT NULL,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  altitude   REAL,
  accuracy   REAL,
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_route_points_session_time ON route_points (session_id, timestamp);
`;

function migrateDatabase(db: SQLiteDatabase): void {
  const versionRow = db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > SCHEMA_VERSION) {
    reportError(
      new Error(
        `Database user_version (${currentVersion}) is higher than supported schema version (${SCHEMA_VERSION})`,
      ),
      {
        scope: 'sqliteDatabase.migration',
        currentVersion: String(currentVersion),
        schemaVersion: String(SCHEMA_VERSION),
      },
    );
    return;
  }

  if (currentVersion < 1) {
    db.execSync(MIGRATION_1_DDL);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/** Opens (once), applies pragmas, migrates to SCHEMA_VERSION, returns the handle. */
export function getDatabase(): SQLiteDatabase {
  if (dbHandle) {
    return dbHandle;
  }

  try {
    const db = openDatabaseSync(DATABASE_NAME);
    db.execSync('PRAGMA foreign_keys = ON');
    db.execSync('PRAGMA journal_mode = WAL');

    db.withTransactionSync(() => {
      migrateDatabase(db);
    });

    dbHandle = db;
    return dbHandle;
  } catch (error) {
    reportError(error, { scope: 'sqliteDatabase.getDatabase' });
    throw error;
  }
}

/** Test-only: drops the memoized handle so the next call re-opens. */
export function resetDatabaseForTests(): void {
  if (dbHandle) {
    try {
      dbHandle.closeSync();
    } catch {
      // ignore
    }
    dbHandle = null;
  }
}
