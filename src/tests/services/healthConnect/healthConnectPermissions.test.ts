import {
  type Permission,
  requestPermission,
  __setGrantedPermissions,
  __resetMocks,
} from 'react-native-health-connect';
import { requestHealthConnectPermissions } from '@/services/healthConnect/healthConnectPermissions';
import * as crashService from '@/services/crashService';

describe('requestHealthConnectPermissions', () => {
  const testPermissions: Permission[] = [
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'write', recordType: 'ExerciseSession' },
  ];

  beforeEach(() => {
    __resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns granted when all requested permissions are granted', async () => {
    __setGrantedPermissions([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]);

    const result = await requestHealthConnectPermissions(testPermissions);

    expect(result).toBe('granted');
    expect(requestPermission).toHaveBeenCalledWith(testPermissions);
  });

  it('returns denied when none of the requested permissions are granted', async () => {
    __setGrantedPermissions([]);

    const result = await requestHealthConnectPermissions(testPermissions);

    expect(result).toBe('denied');
    expect(requestPermission).toHaveBeenCalledWith(testPermissions);
  });

  it('returns partial when some but not all requested permissions are granted', async () => {
    __setGrantedPermissions([
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    const result = await requestHealthConnectPermissions(testPermissions);

    expect(result).toBe('partial');
    expect(requestPermission).toHaveBeenCalledWith(testPermissions);
  });

  it('catches thrown error, reports through crashService, and resolves to denied', async () => {
    const testError = new Error('Permission dialog dismissed unexpectedly');
    __setGrantedPermissions(testError);
    const reportSpy = jest.spyOn(crashService, 'reportError');

    const result = await requestHealthConnectPermissions(testPermissions);

    expect(result).toBe('denied');
    expect(reportSpy).toHaveBeenCalledWith(testError, {
      scope: 'healthConnectPermissions',
    });
  });

  it('returns granted if empty permission array is requested', async () => {
    const result = await requestHealthConnectPermissions([]);
    expect(result).toBe('granted');
  });
});
