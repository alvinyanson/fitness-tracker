import { Platform } from 'react-native';
import {
  insertRecords,
  __setSdkStatus,
  __setInitializeResult,
  __setGrantedPermissions,
  __setGrantedPermissionsList,
  __setInsertResult,
  __resetMocks,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { writeSessionToHealthConnect } from '@/services/healthConnect/writeSessionToHealthConnect';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import * as crashService from '@/services/crashService';
import * as storage from '@/services/storage/sessionHistoryStorage';

describe('writeSessionToHealthConnect', () => {
  const mockNow = 1700005000000;
  const nowFn = () => mockNow;

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

  const mockSession: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1700000000000',
    startedAt: 1700000000000,
    endedAt: 1700003600000,
    stats: {
      durationMs: 3600000,
      avgHr: 140,
      maxHr: 160,
      minHr: 120,
      sampleCount: 2,
      rawSampleCount: 2,
    },
    samples: [
      {
        timestamp: 1700001000000,
        bpm: 130,
        sensorContact: 'contactDetected',
      },
      {
        timestamp: 1700002000000,
        bpm: 150,
        sensorContact: 'contactDetected',
      },
    ],
  };

  let updateStorageSpy: jest.SpyInstance;
  let reportErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetMocks();
    setPlatform('android', 34);
    jest.clearAllMocks();
    updateStorageSpy = jest.spyOn(storage, 'updateSessionHealthConnect');
    reportErrorSpy = jest.spyOn(crashService, 'reportError');

    // Default healthy mock state
    __setSdkStatus(SdkAvailabilityStatus.SDK_AVAILABLE);
    __setInitializeResult(true);
    __setGrantedPermissionsList([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'HeartRate' },
    ]);
    __setInsertResult(['exercise-rec-id-1', 'hr-rec-id-2']);
  });

  afterEach(() => {
    setPlatform(originalPlatformOS, originalPlatformVersion);
    jest.restoreAllMocks();
  });

  it('short-circuits and makes no native calls when session is already synced', async () => {
    const alreadySyncedSession: PersistedSession = {
      ...mockSession,
      healthConnect: {
        state: 'synced',
        attemptedAt: 1700004000000,
        syncedAt: 1700004000000,
        exerciseRecordId: 'existing-id',
      },
    };

    const result = await writeSessionToHealthConnect(alreadySyncedSession, {
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'already-synced',
      sync: alreadySyncedSession.healthConnect,
    });
    expect(insertRecords).not.toHaveBeenCalled();
    expect(updateStorageSpy).not.toHaveBeenCalled();
  });

  it('fails with unavailable when Health Connect is not available', async () => {
    __setSdkStatus(SdkAvailabilityStatus.SDK_UNAVAILABLE);

    const result = await writeSessionToHealthConnect(mockSession, {
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'failed',
      sync: {
        state: 'failed',
        attemptedAt: mockNow,
        reason: 'unavailable',
      },
    });
    expect(updateStorageSpy).toHaveBeenCalledWith(mockSession.id, {
      state: 'failed',
      attemptedAt: mockNow,
      reason: 'unavailable',
    });
    expect(insertRecords).not.toHaveBeenCalled();
  });

  it('skips permission request when permissions are already granted', async () => {
    __setGrantedPermissionsList([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'HeartRate' },
    ]);

    const result = await writeSessionToHealthConnect(mockSession, {
      now: nowFn,
    });

    expect(result.status).toBe('synced');
    expect(insertRecords).toHaveBeenCalled();
  });

  it('requests permissions when missing and proceeds if granted', async () => {
    __setGrantedPermissionsList([]);
    __setGrantedPermissions([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'HeartRate' },
    ]);

    const result = await writeSessionToHealthConnect(mockSession, {
      now: nowFn,
    });

    expect(result.status).toBe('synced');
    expect(insertRecords).toHaveBeenCalled();
  });

  it('fails with permission-denied when permission request returns partial or denied', async () => {
    __setGrantedPermissionsList([]);
    __setGrantedPermissions([
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]); // partial grant

    const result = await writeSessionToHealthConnect(mockSession, {
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'failed',
      sync: {
        state: 'failed',
        attemptedAt: mockNow,
        reason: 'permission-denied',
      },
    });
    expect(updateStorageSpy).toHaveBeenCalledWith(mockSession.id, {
      state: 'failed',
      attemptedAt: mockNow,
      reason: 'permission-denied',
    });
    expect(insertRecords).not.toHaveBeenCalled();
  });

  it('inserts both ExerciseSession and HeartRate records for a session with samples and persists exerciseRecordId', async () => {
    const result = await writeSessionToHealthConnect(mockSession, {
      title: 'Morning Workout',
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'synced',
      sync: {
        state: 'synced',
        attemptedAt: mockNow,
        syncedAt: mockNow,
        exerciseRecordId: 'exercise-rec-id-1',
      },
    });

    expect(insertRecords).toHaveBeenCalledTimes(1);
    const passedRecords = (insertRecords as jest.Mock).mock.calls[0][0];
    expect(passedRecords).toHaveLength(2);
    expect(passedRecords[0].recordType).toBe('ExerciseSession');
    expect(passedRecords[0].title).toBe('Morning Workout');
    expect(passedRecords[1].recordType).toBe('HeartRate');

    expect(updateStorageSpy).toHaveBeenCalledWith(mockSession.id, {
      state: 'synced',
      attemptedAt: mockNow,
      syncedAt: mockNow,
      exerciseRecordId: 'exercise-rec-id-1',
    });
  });

  it('inserts only ExerciseSession record when session has no valid HR samples', async () => {
    const noHrSession: PersistedSession = {
      ...mockSession,
      samples: [],
    };
    __setInsertResult(['exercise-only-id']);

    const result = await writeSessionToHealthConnect(noHrSession, {
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'synced',
      sync: {
        state: 'synced',
        attemptedAt: mockNow,
        syncedAt: mockNow,
        exerciseRecordId: 'exercise-only-id',
      },
    });

    expect(insertRecords).toHaveBeenCalledTimes(1);
    const passedRecords = (insertRecords as jest.Mock).mock.calls[0][0];
    expect(passedRecords).toHaveLength(1);
    expect(passedRecords[0].recordType).toBe('ExerciseSession');
  });

  it('catches insertRecords rejection, reports via crashService, persists write-failed, and does not throw', async () => {
    const insertError = new Error('Database disk full');
    __setInsertResult(insertError);

    const result = await writeSessionToHealthConnect(mockSession, {
      now: nowFn,
    });

    expect(result).toEqual({
      status: 'failed',
      sync: {
        state: 'failed',
        attemptedAt: mockNow,
        reason: 'write-failed',
      },
    });

    expect(reportErrorSpy).toHaveBeenCalledWith(insertError, {
      scope: 'healthConnectSessionWrite',
      sessionId: mockSession.id,
    });

    expect(updateStorageSpy).toHaveBeenCalledWith(mockSession.id, {
      state: 'failed',
      attemptedAt: mockNow,
      reason: 'write-failed',
    });
  });
});
