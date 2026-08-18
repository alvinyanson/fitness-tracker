/** Whether the app can currently write to Health Connect. */
export type HealthConnectAvailability =
  'available' | 'needs-install' | 'needs-update' | 'unsupported';

/** Outcome of requesting a set of Health Connect record-type permissions. */
export type HealthConnectPermissionStatus = 'granted' | 'partial' | 'denied';

/** Why a Health Connect write could not complete. */
export type HealthConnectWriteFailureReason =
  | 'unavailable' // Health Connect missing, outdated, or OS-unsupported
  | 'permission-denied' // write permission not granted (or revoked in system settings)
  | 'write-failed'; // insertRecords rejected

/** Terminal, persisted sync outcome for one session. */
export interface SessionHealthConnectSync {
  state: 'synced' | 'failed';
  /** Epoch ms of the attempt that produced `state`. */
  attemptedAt: number;
  /** Set only when `state === 'synced'`. */
  syncedAt?: number;
  /** First id returned by `insertRecords`; the issue's "store the returned record id". */
  exerciseRecordId?: string;
  /** Set only when `state === 'failed'`. */
  reason?: HealthConnectWriteFailureReason;
}

/** Live UI state; `'unsynced'` and `'syncing'` are never persisted. */
export type HealthConnectSyncState =
  'unsynced' | 'syncing' | 'synced' | 'failed';

/** Outcome of one `writeSessionToHealthConnect` call. */
export type HealthConnectWriteResult =
  | { status: 'synced'; sync: SessionHealthConnectSync }
  | { status: 'already-synced'; sync: SessionHealthConnectSync }
  | { status: 'failed'; sync: SessionHealthConnectSync };
