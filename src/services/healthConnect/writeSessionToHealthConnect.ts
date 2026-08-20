import { insertRecords } from 'react-native-health-connect';
import type {
  HealthConnectWriteFailureReason,
  HealthConnectWriteResult,
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
import {
  failedOutcome,
  MAX_SYNC_ATTEMPTS,
  syncedOutcome,
} from '@/services/healthConnect/syncOutcome';
import { updateSessionHealthConnect } from '@/services/storage/sessionHistoryStorage';

export { MAX_SYNC_ATTEMPTS };

function persistSyncOutcome(
  sessionId: string,
  sync: ReturnType<typeof syncedOutcome> | ReturnType<typeof failedOutcome>,
): void {
  const updated = updateSessionHealthConnect(sessionId, sync);
  if (!updated) {
    reportError(
      new Error(`Session not found when updating sync state: ${sessionId}`),
      {
        scope: 'healthConnectSessionWrite.storageUpdate',
        sessionId,
      },
    );
  }
}

async function checkPreconditions(
  promptForPermissions: boolean,
): Promise<HealthConnectWriteFailureReason | null> {
  const availability = await getHealthConnectAvailability();
  if (availability !== 'available') {
    return 'unavailable';
  }

  const hasPermissions = await hasHealthConnectPermissions(
    SESSION_WRITE_PERMISSIONS,
  );

  if (!hasPermissions) {
    if (!promptForPermissions) {
      return 'permission-denied';
    }

    const permissionStatus = await requestHealthConnectPermissions(
      SESSION_WRITE_PERMISSIONS,
    );
    if (permissionStatus !== 'granted') {
      return 'permission-denied';
    }
  }

  return null;
}

export async function writeSessionToHealthConnect(
  session: PersistedSession,
  options?: {
    title?: string;
    now?: () => number;
    /** Default `true` — preserves the summary screen's behavior. */
    promptForPermissions?: boolean;
    /** User-initiated: clears `failedAttempts` before attempting. */
    manual?: boolean;
    /** Skip availability/permission checks (caller already verified). */
    skipPreconditions?: boolean;
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
    if (!options?.skipPreconditions) {
      const preconditionFailure =
        await checkPreconditions(promptForPermissions);
      if (preconditionFailure) {
        const sync = failedOutcome(
          now,
          preconditionFailure,
          currentFailedAttempts,
        );
        persistSyncOutcome(session.id, sync);
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

    const sync = syncedOutcome(now, exerciseRecordId);
    persistSyncOutcome(session.id, sync);
    return { status: 'synced', sync };
  } catch (error) {
    reportError(error, {
      scope: 'healthConnectSessionWrite',
      sessionId: session.id,
    });

    let reason: HealthConnectWriteFailureReason = 'write-failed';
    try {
      const availability = await getHealthConnectAvailability();
      if (availability !== 'available') {
        reason = 'unavailable';
      } else {
        const hasPermissions = await hasHealthConnectPermissions(
          SESSION_WRITE_PERMISSIONS,
        );
        if (!hasPermissions) {
          reason = 'permission-denied';
        }
      }
    } catch {
      // Retain write-failed fallback
    }

    const sync = failedOutcome(now, reason, currentFailedAttempts);
    persistSyncOutcome(session.id, sync);
    return { status: 'failed', sync };
  }
}
