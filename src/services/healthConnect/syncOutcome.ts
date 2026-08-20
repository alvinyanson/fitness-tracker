import type {
  HealthConnectWriteFailureReason,
  SessionHealthConnectSync,
} from '@/interfaces/healthConnect';

export const MAX_SYNC_ATTEMPTS = 5;

/** Build a "synced" outcome. */
export function syncedOutcome(
  now: number,
  exerciseRecordId?: string,
): SessionHealthConnectSync {
  return {
    state: 'synced',
    attemptedAt: now,
    syncedAt: now,
    ...(exerciseRecordId !== undefined ? { exerciseRecordId } : {}),
  };
}

/** Build a "failed" or "abandoned" outcome. */
export function failedOutcome(
  now: number,
  reason: HealthConnectWriteFailureReason,
  failedAttempts: number,
): SessionHealthConnectSync {
  const countWriteFailure = reason === 'write-failed';
  const newAttempts = countWriteFailure ? failedAttempts + 1 : failedAttempts;
  const isAbandoned = countWriteFailure && newAttempts >= MAX_SYNC_ATTEMPTS;

  return {
    state: isAbandoned ? 'abandoned' : 'failed',
    attemptedAt: now,
    reason,
    ...(newAttempts > 0 ? { failedAttempts: newAttempts } : {}),
  };
}
