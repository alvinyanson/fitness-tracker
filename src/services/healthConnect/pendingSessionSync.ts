import type {
  HealthConnectFlushResult,
  HealthConnectFlushSkipReason,
  HealthConnectSyncQueueSummary,
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
import { MAX_SYNC_ATTEMPTS } from '@/services/healthConnect/syncOutcome';
import { writeSessionToHealthConnect } from '@/services/healthConnect/writeSessionToHealthConnect';
import {
  getSession,
  getSessionIndex,
} from '@/services/storage/sessionHistoryStorage';

export { MAX_SYNC_ATTEMPTS };

/** Backoff before attempt N+1, indexed by `failedAttempts`; last value is the cap. */
export const SYNC_BACKOFF_MS: readonly number[] = [
  0, 60_000, 300_000, 900_000, 3_600_000,
];

/** Cap on writes per pass. */
export const DEFAULT_FLUSH_LIMIT = 25;

export function nextEligibleAt(
  sync: SessionHealthConnectSync | undefined,
): number {
  if (!sync) {
    return 0;
  }
  const failedAttempts = sync.failedAttempts ?? 0;
  const backoffIndex = Math.min(
    Math.max(0, failedAttempts),
    SYNC_BACKOFF_MS.length - 1,
  );
  return sync.attemptedAt + SYNC_BACKOFF_MS[backoffIndex]!;
}

type SyncCategory =
  'unsynced' | 'eligible' | 'backoff' | 'abandoned' | 'synced';

function classifySession(session: PersistedSession, now: number): SyncCategory {
  const sync = session.healthConnect;
  if (!sync) {
    return 'unsynced';
  }
  if (sync.state === 'synced') {
    return 'synced';
  }
  if (sync.state === 'abandoned') {
    return 'abandoned';
  }
  return nextEligibleAt(sync) <= now ? 'eligible' : 'backoff';
}

export function selectPendingSessions(options?: {
  now?: number;
  ignoreBackoff?: boolean;
  includeAbandoned?: boolean;
}): PersistedSession[] {
  const now = options?.now ?? Date.now();
  const ignoreBackoff = options?.ignoreBackoff ?? false;
  const includeAbandoned = options?.includeAbandoned ?? false;

  const indexEntries = getSessionIndex();
  // Oldest first: getSessionIndex() is newest-first, so reversing gives oldest-first
  const oldestFirstEntries = [...indexEntries].reverse();
  const pendingSessions: PersistedSession[] = [];

  for (const entry of oldestFirstEntries) {
    try {
      const session = getSession(entry.id);
      if (!session) {
        reportError(
          new Error(`Session not found for index entry: ${entry.id}`),
          {
            scope: 'pendingSessionSync.selectPendingSessions',
            sessionId: entry.id,
          },
        );
        continue;
      }

      const category = classifySession(session, now);
      if (
        category === 'unsynced' ||
        category === 'eligible' ||
        (category === 'backoff' && ignoreBackoff) ||
        (category === 'abandoned' && includeAbandoned)
      ) {
        pendingSessions.push(session);
      }
    } catch (error) {
      reportError(error, {
        scope: 'pendingSessionSync.selectPendingSessions',
        sessionId: entry.id,
      });
    }
  }

  return pendingSessions;
}

export function getSyncQueueSummary(options?: {
  now?: number;
}): HealthConnectSyncQueueSummary {
  const now = options?.now ?? Date.now();
  const indexEntries = getSessionIndex();
  let pending = 0;
  let eligible = 0;
  let abandoned = 0;

  for (const entry of indexEntries) {
    try {
      const session = getSession(entry.id);
      if (!session) {
        reportError(
          new Error(`Session not found for index entry: ${entry.id}`),
          {
            scope: 'pendingSessionSync.getSyncQueueSummary',
            sessionId: entry.id,
          },
        );
        continue;
      }

      const category = classifySession(session, now);
      switch (category) {
        case 'unsynced':
        case 'eligible':
          pending += 1;
          eligible += 1;
          break;
        case 'backoff':
          pending += 1;
          break;
        case 'abandoned':
          abandoned += 1;
          break;
        case 'synced':
          break;
      }
    } catch (error) {
      reportError(error, {
        scope: 'pendingSessionSync.getSyncQueueSummary',
        sessionId: entry.id,
      });
    }
  }

  return { pending, eligible, abandoned };
}

let isFlushing = false;

/** A flush pass that wrote nothing, with the reason it stopped (`null` on error). */
function skippedResult(
  reason: HealthConnectFlushSkipReason | null,
  finishedAt: number,
): HealthConnectFlushResult {
  return {
    attempted: 0,
    synced: 0,
    failed: 0,
    abandoned: 0,
    deferred: 0,
    skipped: reason,
    finishedAt,
  };
}

export async function flushPendingSessions(options?: {
  title?: string;
  manual?: boolean;
  maxSessions?: number;
  now?: () => number;
}): Promise<HealthConnectFlushResult> {
  const getNow = options?.now ?? Date.now;

  if (isFlushing) {
    return skippedResult('already-flushing', getNow());
  }

  isFlushing = true;
  try {
    const manual = options?.manual ?? false;
    const now = getNow();
    const pending = selectPendingSessions({
      now,
      ignoreBackoff: manual,
      includeAbandoned: manual,
    });

    if (pending.length === 0) {
      return skippedResult('nothing-pending', getNow());
    }

    const availability = await getHealthConnectAvailability();
    if (availability !== 'available') {
      return skippedResult('unavailable', getNow());
    }

    const hasPermissions = await hasHealthConnectPermissions(
      SESSION_WRITE_PERMISSIONS,
    );

    if (!hasPermissions) {
      // Only a manual flush may prompt; a background pass just defers.
      const status = manual
        ? await requestHealthConnectPermissions(SESSION_WRITE_PERMISSIONS)
        : 'denied';
      if (status !== 'granted') {
        return skippedResult('permission-denied', getNow());
      }
    }

    const maxSessions = options?.maxSessions ?? DEFAULT_FLUSH_LIMIT;
    const sessionsToFlush = pending.slice(0, maxSessions);
    const deferred = Math.max(0, pending.length - sessionsToFlush.length);

    let attempted = 0;
    let synced = 0;
    let failed = 0;
    let abandoned = 0;

    for (const session of sessionsToFlush) {
      attempted += 1;
      try {
        const result = await writeSessionToHealthConnect(session, {
          title: options?.title,
          promptForPermissions: false,
          manual,
          now: options?.now,
          skipPreconditions: true,
        });

        if (result.status === 'synced' || result.status === 'already-synced') {
          synced += 1;
        } else if (result.sync.state === 'abandoned') {
          abandoned += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        reportError(err, {
          scope: 'pendingSessionSync.flushPendingSessions',
          sessionId: session.id,
        });
        failed += 1;
      }
    }

    return {
      attempted,
      synced,
      failed,
      abandoned,
      deferred,
      skipped: null,
      finishedAt: getNow(),
    };
  } catch (error) {
    reportError(error, {
      scope: 'pendingSessionSync.flushPendingSessions',
    });
    return skippedResult(null, getNow());
  } finally {
    isFlushing = false;
  }
}
