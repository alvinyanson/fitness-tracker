import { Platform } from 'react-native';
import {
  __setSdkStatus,
  __setInitializeResult,
  __setGrantedPermissions,
  __setGrantedPermissionsList,
  __setInsertResult,
  __resetMocks,
  SdkAvailabilityStatus,
  insertRecords,
  requestPermission,
} from 'react-native-health-connect';
import { createMMKV } from 'react-native-mmkv';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import * as crashService from '@/services/crashService';
import {
  DEFAULT_FLUSH_LIMIT,
  flushPendingSessions,
  getSyncQueueSummary,
  nextEligibleAt,
  selectPendingSessions,
  SYNC_BACKOFF_MS,
} from '@/services/healthConnect/pendingSessionSync';
import {
  getSession,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';

describe('pendingSessionSync', () => {
  const originalPlatformOS = Platform.OS;
  const originalPlatformVersion = Platform.Version;

  function setPlatform(os: typeof Platform.OS, version: number | string) {
    Object.defineProperty(Platform, 'OS', {
      get: () => os,
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      get: () => version,
      configurable: true,
    });
  }

  function createMockSession(
    id: string,
    startedAt: number,
    healthConnect?: PersistedSession['healthConnect'],
  ): PersistedSession {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id,
      startedAt,
      endedAt: startedAt + 3600000,
      stats: {
        durationMs: 3600000,
        avgHr: 140,
        maxHr: 160,
        minHr: 120,
        sampleCount: 1,
        rawSampleCount: 1,
      },
      samples: [
        {
          timestamp: startedAt + 1000,
          bpm: 140,
          sensorContact: 'contactDetected',
        },
      ],
      healthConnect,
    };
  }

  let reportErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    createMMKV().clearAll();
    __resetMocks();
    setPlatform('android', 34);
    jest.clearAllMocks();
    reportErrorSpy = jest.spyOn(crashService, 'reportError');

    // Default healthy mock state
    __setSdkStatus(SdkAvailabilityStatus.SDK_AVAILABLE);
    __setInitializeResult(true);
    __setGrantedPermissionsList([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'HeartRate' },
    ]);
    __setInsertResult(['rec-id-1', 'rec-id-2']);
  });

  afterEach(() => {
    setPlatform(originalPlatformOS, originalPlatformVersion);
    jest.restoreAllMocks();
  });

  describe('nextEligibleAt', () => {
    it('returns 0 for undefined sync (never attempted)', () => {
      expect(nextEligibleAt(undefined)).toBe(0);
    });

    it('computes backoff based on failedAttempts and caps at last backoff interval', () => {
      const baseTime = 1000000;

      // 0 failures: +0ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 0,
        }),
      ).toBe(baseTime + SYNC_BACKOFF_MS[0]!);

      // absent failedAttempts (pre-#17): treated as 0
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
        }),
      ).toBe(baseTime + SYNC_BACKOFF_MS[0]!);

      // 1 failure: +60,000ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 1,
        }),
      ).toBe(baseTime + 60_000);

      // 2 failures: +300,000ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 2,
        }),
      ).toBe(baseTime + 300_000);

      // 3 failures: +900,000ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 3,
        }),
      ).toBe(baseTime + 900_000);

      // 4 failures: +3,600,000ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 4,
        }),
      ).toBe(baseTime + 3_600_000);

      // 10 failures: capped at +3,600,000ms
      expect(
        nextEligibleAt({
          state: 'failed',
          attemptedAt: baseTime,
          failedAttempts: 10,
        }),
      ).toBe(baseTime + 3_600_000);
    });

    it('exports DEFAULT_FLUSH_LIMIT as 25', () => {
      expect(DEFAULT_FLUSH_LIMIT).toBe(25);
    });
  });

  describe('selectPendingSessions and getSyncQueueSummary', () => {
    it('returns oldest-first and filters synced and backoff-pending sessions', () => {
      const now = 2000000;

      // Oldest: unsynced
      const session1 = createMockSession('session-1', 1000000);
      // Middle: failed recently with 1 failure (needs 60s backoff -> eligible at 1900000 + 60000 = 1960000 <= 2000000)
      const session2 = createMockSession('session-2', 1100000, {
        state: 'failed',
        attemptedAt: 1900000,
        failedAttempts: 1,
        reason: 'write-failed',
      });
      // Newest: failed very recently with 1 failure (attempted at 1990000 -> eligible at 2050000 > 2000000)
      const session3 = createMockSession('session-3', 1200000, {
        state: 'failed',
        attemptedAt: 1990000,
        failedAttempts: 1,
        reason: 'write-failed',
      });
      // Synced session
      const sessionSynced = createMockSession('session-synced', 1300000, {
        state: 'synced',
        attemptedAt: 1350000,
        syncedAt: 1350000,
        exerciseRecordId: 'rec-1',
      });
      // Abandoned session
      const sessionAbandoned = createMockSession('session-abandoned', 1400000, {
        state: 'abandoned',
        attemptedAt: 1450000,
        failedAttempts: 5,
        reason: 'write-failed',
      });

      saveSession(session1);
      saveSession(session2);
      saveSession(session3);
      saveSession(sessionSynced);
      saveSession(sessionAbandoned);

      const pending = selectPendingSessions({ now });
      expect(pending.map((s) => s.id)).toEqual(['session-1', 'session-2']);

      const summary = getSyncQueueSummary({ now });
      // pending = session1, session2, session3 (3 total unsynced & not abandoned)
      // eligible = session1, session2 (2 whose backoff elapsed)
      // abandoned = sessionAbandoned (1)
      expect(summary).toEqual({
        pending: 3,
        eligible: 2,
        abandoned: 1,
      });
    });

    it('includes abandoned sessions when includeAbandoned: true', () => {
      const now = 2000000;
      const session = createMockSession('session-abandoned', 1000000, {
        state: 'abandoned',
        attemptedAt: 1500000,
        failedAttempts: 5,
        reason: 'write-failed',
      });
      saveSession(session);

      expect(selectPendingSessions({ now, includeAbandoned: false })).toEqual(
        [],
      );
      expect(
        selectPendingSessions({ now, includeAbandoned: true }).map((s) => s.id),
      ).toEqual(['session-abandoned']);
    });

    it('ignores backoff when ignoreBackoff: true', () => {
      const now = 2000000;
      const session = createMockSession('session-recent-failure', 1000000, {
        state: 'failed',
        attemptedAt: 1990000,
        failedAttempts: 1,
        reason: 'write-failed',
      });
      saveSession(session);

      expect(selectPendingSessions({ now, ignoreBackoff: false })).toEqual([]);
      expect(
        selectPendingSessions({ now, ignoreBackoff: true }).map((s) => s.id),
      ).toEqual(['session-recent-failure']);
    });

    it('skips missing session blob and reports error', () => {
      const session1 = createMockSession('session-1', 1000000);
      saveSession(session1);

      // Corrupt the session blob in MMKV while leaving index
      createMMKV().remove('@fitness_tracker/session/session-1');

      const pending = selectPendingSessions({ now: 2000000 });
      expect(pending).toEqual([]);
      expect(reportErrorSpy).toHaveBeenCalled();

      const summary = getSyncQueueSummary({ now: 2000000 });
      expect(summary).toEqual({ pending: 0, eligible: 0, abandoned: 0 });
    });
  });

  describe('flushPendingSessions', () => {
    it('returns skipped: nothing-pending when queue has no pending sessions', async () => {
      const result = await flushPendingSessions();
      expect(result.skipped).toBe('nothing-pending');
      expect(result.attempted).toBe(0);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('returns skipped: unavailable and touches no persisted state when Health Connect is unavailable', async () => {
      __setSdkStatus(SdkAvailabilityStatus.SDK_UNAVAILABLE);

      const session = createMockSession('session-1', 1000000);
      saveSession(session);

      const result = await flushPendingSessions();
      expect(result.skipped).toBe('unavailable');
      expect(result.attempted).toBe(0);

      // Verify session was untouched
      const stored = getSession('session-1');
      expect(stored?.healthConnect).toBeUndefined();
    });

    it('returns skipped: permission-denied without prompting when manual: false and permissions missing', async () => {
      __setGrantedPermissionsList([]);

      const session = createMockSession('session-1', 1000000);
      saveSession(session);

      const result = await flushPendingSessions({ manual: false });
      expect(result.skipped).toBe('permission-denied');
      expect(result.attempted).toBe(0);
      expect(requestPermission).not.toHaveBeenCalled();

      // Session untouched
      const stored = getSession('session-1');
      expect(stored?.healthConnect).toBeUndefined();
    });

    it('requests permissions and flushes backlog when manual: true and permissions missing but granted', async () => {
      __setGrantedPermissionsList([]);
      __setGrantedPermissions([
        { accessType: 'write', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'HeartRate' },
      ]);

      const session = createMockSession('session-1', 1000000);
      saveSession(session);

      const result = await flushPendingSessions({ manual: true });
      expect(requestPermission).toHaveBeenCalled();
      expect(result.skipped).toBeNull();
      expect(result.attempted).toBe(1);
      expect(result.synced).toBe(1);

      const stored = getSession('session-1');
      expect(stored?.healthConnect?.state).toBe('synced');
    });

    it('handles partial failure flush sequentially without stopping remainder', async () => {
      const session1 = createMockSession('session-1', 1000000);
      const session2 = createMockSession('session-2', 1100000);
      const session3 = createMockSession('session-3', 1200000);
      saveSession(session1);
      saveSession(session2);
      saveSession(session3);

      // Session 1 succeeds, Session 2 throws, Session 3 succeeds
      let callCount = 0;
      (insertRecords as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Disk error on session 2');
        }
        return ['rec-id'];
      });

      const result = await flushPendingSessions();
      expect(result).toMatchObject({
        attempted: 3,
        synced: 2,
        failed: 1,
        abandoned: 0,
        deferred: 0,
        skipped: null,
      });

      expect(getSession('session-1')?.healthConnect?.state).toBe('synced');
      expect(getSession('session-2')?.healthConnect?.state).toBe('failed');
      expect(getSession('session-2')?.healthConnect?.failedAttempts).toBe(1);
      expect(getSession('session-3')?.healthConnect?.state).toBe('synced');
    });

    it('marks session abandoned when it crosses MAX_SYNC_ATTEMPTS during flush', async () => {
      const session = createMockSession('session-1', 1000000, {
        state: 'failed',
        attemptedAt: 1000000,
        failedAttempts: 4,
        reason: 'write-failed',
      });
      saveSession(session);

      (insertRecords as jest.Mock).mockRejectedValueOnce(
        new Error('Persistent failure'),
      );

      const result = await flushPendingSessions({
        now: () => 1000000 + 4000000,
      });
      expect(result).toMatchObject({
        attempted: 1,
        synced: 0,
        failed: 0,
        abandoned: 1,
        skipped: null,
      });

      const stored = getSession('session-1');
      expect(stored?.healthConnect?.state).toBe('abandoned');
      expect(stored?.healthConnect?.failedAttempts).toBe(5);
    });

    it('defers sessions exceeding maxSessions limit', async () => {
      const session1 = createMockSession('session-1', 1000000);
      const session2 = createMockSession('session-2', 1100000);
      const session3 = createMockSession('session-3', 1200000);
      saveSession(session1);
      saveSession(session2);
      saveSession(session3);

      const result = await flushPendingSessions({ maxSessions: 2 });
      expect(result.attempted).toBe(2);
      expect(result.synced).toBe(2);
      expect(result.deferred).toBe(1);

      expect(getSession('session-1')?.healthConnect?.state).toBe('synced');
      expect(getSession('session-2')?.healthConnect?.state).toBe('synced');
      expect(getSession('session-3')?.healthConnect).toBeUndefined();
    });

    it('guards against concurrent flushes and returns skipped: already-flushing', async () => {
      const session1 = createMockSession('session-1', 1000000);
      const session2 = createMockSession('session-2', 1100000);
      saveSession(session1);
      saveSession(session2);

      let resolveFirstInsert!: (val: string[]) => void;
      const insertPromise = new Promise<string[]>((resolve) => {
        resolveFirstInsert = resolve;
      });
      (insertRecords as jest.Mock).mockImplementationOnce(() => insertPromise);

      // Start first flush (will pause during insert)
      const firstFlushPromise = flushPendingSessions();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Start second concurrent flush
      const secondResult = await flushPendingSessions();
      expect(secondResult.skipped).toBe('already-flushing');
      expect(secondResult.attempted).toBe(0);

      // Let first finish
      resolveFirstInsert(['rec-id-1']);
      const firstResult = await firstFlushPromise;
      expect(firstResult.skipped).toBeNull();
      expect(firstResult.attempted).toBe(2);
    });

    it('does not double-write already synced sessions', async () => {
      const syncedSession = createMockSession('session-synced', 1000000, {
        state: 'synced',
        attemptedAt: 1000000,
        syncedAt: 1000000,
        exerciseRecordId: 'rec-1',
      });
      saveSession(syncedSession);

      const result = await flushPendingSessions();
      expect(result.skipped).toBe('nothing-pending');
      expect(insertRecords).not.toHaveBeenCalled();
    });
  });
});
