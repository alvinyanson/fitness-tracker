import type { PersistedSession, SessionIndexEntry } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import { getItem, setItem } from '@/services/storage/mmkvStorage';
import { saveSession } from '@/services/storage/sessionHistoryStorage';
import { getDatabase } from '@/services/storage/sqliteDatabase';

export const SESSION_MIGRATION_FLAG_KEY =
  '@fitness_tracker/session-migration-v1';
export const LEGACY_SESSION_INDEX_KEY = '@fitness_tracker/session-index';
export const LEGACY_SESSION_PREFIX = '@fitness_tracker/session/';

export interface SessionMigrationResult {
  migrated: number;
  skipped: number;
}

export function migrateSessionsToSqlite(): SessionMigrationResult {
  try {
    const flag = getItem<string>(SESSION_MIGRATION_FLAG_KEY);
    if (flag === 'done') {
      return { migrated: 0, skipped: 0 };
    }

    const legacyIndex = getItem<SessionIndexEntry[]>(LEGACY_SESSION_INDEX_KEY);
    if (
      !legacyIndex ||
      !Array.isArray(legacyIndex) ||
      legacyIndex.length === 0
    ) {
      setItem(SESSION_MIGRATION_FLAG_KEY, 'done');
      return { migrated: 0, skipped: 0 };
    }

    const db = getDatabase();
    let migrated = 0;
    let skipped = 0;

    db.withTransactionSync(() => {
      for (const entry of legacyIndex) {
        if (!entry || !entry.id) {
          skipped++;
          continue;
        }

        const existing = db.getFirstSync<{ id: string }>(
          'SELECT id FROM sessions WHERE id = ?',
          [entry.id],
        );
        if (existing) {
          skipped++;
          continue;
        }

        try {
          const session = getItem<PersistedSession>(
            `${LEGACY_SESSION_PREFIX}${entry.id}`,
          );
          if (!session || !session.id || !session.stats) {
            reportError(
              new Error(
                `Corrupt or missing legacy session blob for id: ${entry.id}`,
              ),
              {
                scope: 'sessionMigration.readBlob',
                sessionId: entry.id,
              },
            );
            skipped++;
            continue;
          }

          saveSession(session);
          migrated++;
        } catch (err) {
          reportError(err, {
            scope: 'sessionMigration.saveBlob',
            sessionId: entry.id,
          });
          skipped++;
        }
      }
    });

    setItem(SESSION_MIGRATION_FLAG_KEY, 'done');
    return { migrated, skipped };
  } catch (error) {
    reportError(error, { scope: 'sessionMigration.migrateSessionsToSqlite' });
    throw error;
  }
}
