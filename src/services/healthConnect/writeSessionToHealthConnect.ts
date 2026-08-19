import { insertRecords } from 'react-native-health-connect';
import type {
  HealthConnectWriteResult,
  SessionHealthConnectSync,
} from '@/interfaces/healthConnect';
import type { PersistedSession } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import { getHealthConnectAvailability } from '@/services/healthConnect/healthConnectAvailability';
import {
  hasHealthConnectPermissions,
  requestHealthConnectPermissions,
  SESSION_WRITE_PERMISSIONS,
} from '@/services/healthConnect/healthConnectPermissions';
import { mapSessionToHealthRecords } from '@/services/healthConnect/sessionToHealthRecords';
import { updateSessionHealthConnect } from '@/services/storage/sessionHistoryStorage';

export const MAX_SYNC_ATTEMPTS = 5;

export async function writeSessionToHealthConnect(
  session: PersistedSession,
  options?: {
    title?: string;
    now?: () => number;
    /** Default `true` — preserves the summary screen's behavior. */
    promptForPermissions?: boolean;
    /** User-initiated: clears `failedAttempts` before attempting. */
    manual?: boolean;
  },
): Promise<HealthConnectWriteResult> {
  if (session.healthConnect?.state === 'synced') {
    return { status: 'already-synced', sync: session.healthConnect };
  }

  const getNow = options?.now ?? Date.now;
  const now = getNow();
  const promptForPermissions = options?.promptForPermissions ?? true;
  const manual = options?.manual ?? false;
  const currentFailedAttempts = manual
    ? 0
    : (session.healthConnect?.failedAttempts ?? 0);

  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== 'available') {
      const sync: SessionHealthConnectSync = {
        state: 'failed',
        attemptedAt: now,
        reason: 'unavailable',
        ...(currentFailedAttempts > 0
          ? { failedAttempts: currentFailedAttempts }
          : {}),
      };
      updateSessionHealthConnect(session.id, sync);
      return { status: 'failed', sync };
    }

    const hasPermissions = await hasHealthConnectPermissions(
      SESSION_WRITE_PERMISSIONS,
    );

    if (!hasPermissions) {
      if (!promptForPermissions) {
        const sync: SessionHealthConnectSync = {
          state: 'failed',
          attemptedAt: now,
          reason: 'permission-denied',
          ...(currentFailedAttempts > 0
            ? { failedAttempts: currentFailedAttempts }
            : {}),
        };
        updateSessionHealthConnect(session.id, sync);
        return { status: 'failed', sync };
      }

      const permissionStatus = await requestHealthConnectPermissions(
        SESSION_WRITE_PERMISSIONS,
      );
      if (permissionStatus !== 'granted') {
        const sync: SessionHealthConnectSync = {
          state: 'failed',
          attemptedAt: now,
          reason: 'permission-denied',
          ...(currentFailedAttempts > 0
            ? { failedAttempts: currentFailedAttempts }
            : {}),
        };
        updateSessionHealthConnect(session.id, sync);
        return { status: 'failed', sync };
      }
    }

    const mapped = mapSessionToHealthRecords(session, {
      title: options?.title,
    });
    const recordsToInsert = [
      mapped.exercise,
      ...(mapped.heartRate ? [mapped.heartRate] : []),
    ];

    const ids = await insertRecords(recordsToInsert);
    const exerciseRecordId = ids[0];

    const sync: SessionHealthConnectSync = {
      state: 'synced',
      attemptedAt: now,
      syncedAt: now,
      exerciseRecordId,
    };
    updateSessionHealthConnect(session.id, sync);
    return { status: 'synced', sync };
  } catch (error) {
    reportError(error, {
      scope: 'healthConnectSessionWrite',
      sessionId: session.id,
    });
    const newFailedAttempts = currentFailedAttempts + 1;
    const isAbandoned = newFailedAttempts >= MAX_SYNC_ATTEMPTS;
    const sync: SessionHealthConnectSync = {
      state: isAbandoned ? 'abandoned' : 'failed',
      attemptedAt: now,
      failedAttempts: newFailedAttempts,
      reason: 'write-failed',
    };
    updateSessionHealthConnect(session.id, sync);
    return { status: 'failed', sync };
  }
}
