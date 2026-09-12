import type { SessionHealthConnectSync } from '@/interfaces/healthConnect';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type {
  PersistedSession,
  SessionIndexEntry,
  SessionRecord,
} from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import { getDatabase } from '@/services/storage/sqliteDatabase';

export interface HrSampleQuery {
  /** Inclusive lower bound, epoch ms. Default: session start. */
  fromMs?: number;
  /** Inclusive upper bound, epoch ms. Default: session end. */
  toMs?: number;
  /** Cap on rows returned; the series is stride-sampled to fit. Default: no cap. */
  limit?: number;
}

interface SessionRow {
  id: string;
  schema_version: number;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  avg_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
  sample_count: number;
  raw_sample_count: number;
  health_connect: string | null;
}

interface HrSampleRow {
  session_id: string;
  seq: number;
  timestamp: number;
  bpm: number;
  sensor_contact: string;
  energy_expended: number | null;
  rr_intervals: string | null;
}

export function saveSession(session: PersistedSession): void {
  try {
    const db = getDatabase();
    const runInTx = (fn: () => void) => {
      if (db.isInTransactionSync()) {
        fn();
      } else {
        db.withTransactionSync(fn);
      }
    };

    runInTx(() => {
      db.runSync(
        `INSERT OR REPLACE INTO sessions (
          id, schema_version, started_at, ended_at, duration_ms,
          avg_hr, max_hr, min_hr, sample_count, raw_sample_count, health_connect
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.schemaVersion,
          session.startedAt,
          session.endedAt,
          session.stats.durationMs,
          session.stats.avgHr,
          session.stats.maxHr,
          session.stats.minHr,
          session.stats.sampleCount,
          session.stats.rawSampleCount,
          session.healthConnect ? JSON.stringify(session.healthConnect) : null,
        ],
      );

      db.runSync('DELETE FROM hr_samples WHERE session_id = ?', [session.id]);

      if (session.samples && session.samples.length > 0) {
        const stmt = db.prepareSync(
          `INSERT INTO hr_samples (
            session_id, seq, timestamp, bpm, sensor_contact, energy_expended, rr_intervals
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );
        try {
          for (let seq = 0; seq < session.samples.length; seq++) {
            const sample = session.samples[seq]!;
            stmt.executeSync(
              session.id,
              seq,
              sample.timestamp,
              sample.bpm,
              sample.sensorContact,
              sample.energyExpended ?? null,
              sample.rrIntervals ? JSON.stringify(sample.rrIntervals) : null,
            );
          }
        } finally {
          stmt.finalizeSync();
        }
      }
    });
  } catch (error) {
    reportError(error, {
      scope: 'sessionHistoryStorage.saveSession',
      id: session.id,
    });
    throw error;
  }
}

export function getSessionRecord(id: string): SessionRecord | null {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<SessionRow>(
      `SELECT id, schema_version, started_at, ended_at, duration_ms,
              avg_hr, max_hr, min_hr, sample_count, raw_sample_count, health_connect
       FROM sessions WHERE id = ?`,
      [id],
    );
    if (!row) {
      return null;
    }

    const record: SessionRecord = {
      schemaVersion: row.schema_version as typeof SESSION_SCHEMA_VERSION,
      id: row.id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      stats: {
        durationMs: row.duration_ms,
        avgHr: row.avg_hr,
        maxHr: row.max_hr,
        minHr: row.min_hr,
        sampleCount: row.sample_count,
        rawSampleCount: row.raw_sample_count,
      },
    };

    if (row.health_connect) {
      try {
        record.healthConnect = JSON.parse(
          row.health_connect,
        ) as SessionHealthConnectSync;
      } catch (err) {
        reportError(err, {
          scope: 'sessionHistoryStorage.getSessionRecord.parseHealthConnect',
          id,
        });
      }
    }

    return record;
  } catch (error) {
    reportError(error, { scope: 'sessionHistoryStorage.getSessionRecord', id });
    return null;
  }
}

export function getSession(id: string): PersistedSession | null {
  try {
    const record = getSessionRecord(id);
    if (!record) {
      return null;
    }
    const samples = getHrSamples(id);
    return {
      ...record,
      samples,
    };
  } catch (error) {
    reportError(error, { scope: 'sessionHistoryStorage.getSession', id });
    return null;
  }
}

export function getSessionIndex(): SessionIndexEntry[] {
  try {
    const db = getDatabase();
    const rows = db.getAllSync<
      Pick<
        SessionRow,
        | 'id'
        | 'started_at'
        | 'ended_at'
        | 'duration_ms'
        | 'avg_hr'
        | 'health_connect'
      >
    >(
      `SELECT id, started_at, ended_at, duration_ms, avg_hr, health_connect
       FROM sessions
       ORDER BY started_at DESC`,
    );

    return rows.map((row) => {
      let healthConnect: SessionHealthConnectSync | undefined;
      if (row.health_connect) {
        try {
          healthConnect = JSON.parse(
            row.health_connect,
          ) as SessionHealthConnectSync;
        } catch (err) {
          reportError(err, {
            scope: 'sessionHistoryStorage.getSessionIndex.parseHealthConnect',
            id: row.id,
          });
        }
      }

      return {
        id: row.id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        durationMs: row.duration_ms,
        avgHr: row.avg_hr,
        ...(healthConnect ? { healthConnect } : {}),
      };
    });
  } catch (error) {
    reportError(error, { scope: 'sessionHistoryStorage.getSessionIndex' });
    return [];
  }
}

export function deleteSession(id: string): void {
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM sessions WHERE id = ?', [id]);
  } catch (error) {
    reportError(error, { scope: 'sessionHistoryStorage.deleteSession', id });
    throw error;
  }
}

export function updateSessionHealthConnect(
  id: string,
  sync: SessionHealthConnectSync,
): SessionRecord | null {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'UPDATE sessions SET health_connect = ? WHERE id = ?',
      [JSON.stringify(sync), id],
    );
    if (result.changes === 0) {
      return null;
    }
    return getSessionRecord(id);
  } catch (error) {
    reportError(error, {
      scope: 'sessionHistoryStorage.updateSessionHealthConnect',
      id,
    });
    throw error;
  }
}

export function getHrSampleCount(sessionId: string): number {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM hr_samples WHERE session_id = ?',
      [sessionId],
    );
    return row?.count ?? 0;
  } catch (error) {
    reportError(error, {
      scope: 'sessionHistoryStorage.getHrSampleCount',
      sessionId,
    });
    return 0;
  }
}

export function getHrSamples(
  sessionId: string,
  query?: HrSampleQuery,
): HeartRateSample[] {
  try {
    const db = getDatabase();
    const conditions: string[] = ['session_id = ?'];
    const baseParams: (string | number)[] = [sessionId];

    if (query?.fromMs !== undefined) {
      conditions.push('timestamp >= ?');
      baseParams.push(query.fromMs);
    }
    if (query?.toMs !== undefined) {
      conditions.push('timestamp <= ?');
      baseParams.push(query.toMs);
    }

    const whereSql = conditions.join(' AND ');

    const countRow = db.getFirstSync<{
      count: number;
      min_seq: number | null;
      max_seq: number | null;
    }>(
      `SELECT COUNT(*) as count, MIN(seq) as min_seq, MAX(seq) as max_seq FROM hr_samples WHERE ${whereSql}`,
      baseParams,
    );

    if (!countRow || countRow.count === 0) {
      return [];
    }

    const count = countRow.count;
    const minSeq = countRow.min_seq ?? 0;
    const maxSeq = countRow.max_seq ?? 0;

    let rows: HrSampleRow[];

    if (query?.limit !== undefined && query.limit > 0 && count > query.limit) {
      const stride = Math.ceil(count / query.limit);
      rows = db.getAllSync<HrSampleRow>(
        `SELECT timestamp, bpm, sensor_contact, energy_expended, rr_intervals, seq
         FROM hr_samples
         WHERE ${whereSql} AND ((seq - ?) % ? = 0 OR seq = ?)
         ORDER BY seq ASC`,
        [...baseParams, minSeq, stride, maxSeq],
      );

      if (rows.length > query.limit) {
        rows.splice(rows.length - 2, rows.length - query.limit);
      }
    } else {
      rows = db.getAllSync<HrSampleRow>(
        `SELECT timestamp, bpm, sensor_contact, energy_expended, rr_intervals, seq
         FROM hr_samples
         WHERE ${whereSql}
         ORDER BY seq ASC`,
        baseParams,
      );
    }

    return rows.map((row) => {
      const sample: HeartRateSample = {
        timestamp: row.timestamp,
        bpm: row.bpm,
        sensorContact: row.sensor_contact as HeartRateSample['sensorContact'],
      };

      if (row.energy_expended !== null && row.energy_expended !== undefined) {
        sample.energyExpended = row.energy_expended;
      }

      if (row.rr_intervals) {
        try {
          sample.rrIntervals = JSON.parse(row.rr_intervals) as number[];
        } catch {
          // ignore malformed JSON
        }
      }

      return sample;
    });
  } catch (error) {
    reportError(error, {
      scope: 'sessionHistoryStorage.getHrSamples',
      sessionId,
    });
    return [];
  }
}
