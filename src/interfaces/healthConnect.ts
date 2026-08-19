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
  /** `'abandoned'` = retry budget exhausted; still manually retryable. */
  state: 'synced' | 'failed' | 'abandoned';
  /** Epoch ms of the attempt that produced `state`. */
  attemptedAt: number;
  /** Consecutive `'write-failed'` attempts. Absent on pre-#17 records = 0. */
  failedAttempts?: number;
  /** Set only when `state === 'synced'`. */
  syncedAt?: number;
  /** First id returned by `insertRecords`; the issue's "store the returned record id". */
  exerciseRecordId?: string;
  /** Set only when `state === 'failed'`. */
  reason?: HealthConnectWriteFailureReason;
}

/** Live UI state; `'unsynced'` and `'syncing'` are never persisted. */
export type HealthConnectSyncState =
  'unsynced' | 'syncing' | 'synced' | 'failed' | 'abandoned';

/** Outcome of one `writeSessionToHealthConnect` call. */
export type HealthConnectWriteResult =
  | { status: 'synced'; sync: SessionHealthConnectSync }
  | { status: 'already-synced'; sync: SessionHealthConnectSync }
  | { status: 'failed'; sync: SessionHealthConnectSync };

/** Counts derived from local sessions; no queue is stored. */
export interface HealthConnectSyncQueueSummary {
  /** Unsynced and not abandoned. */
  pending: number;
  /** Subset of `pending` whose backoff window has elapsed. */
  eligible: number;
  /** Retry budget exhausted; excluded from `pending`. */
  abandoned: number;
}

export type HealthConnectFlushSkipReason =
  'nothing-pending' | 'unavailable' | 'permission-denied' | 'already-flushing';

/** Outcome of one flush pass. */
export interface HealthConnectFlushResult {
  attempted: number;
  synced: number;
  failed: number;
  /** Sessions that crossed `MAX_SYNC_ATTEMPTS` during this pass. */
  abandoned: number;
  /** Eligible sessions left untouched by `maxSessions`. */
  deferred: number;
  skipped: HealthConnectFlushSkipReason | null;
  finishedAt: number;
}
