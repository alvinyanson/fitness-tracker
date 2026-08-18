import {
  type Permission,
  requestPermission,
  getGrantedPermissions,
  __setGrantedPermissions,
  __setGrantedPermissionsList,
  __resetMocks,
} from 'react-native-health-connect';
import {
  SESSION_WRITE_PERMISSIONS,
  hasHealthConnectPermissions,
  requestHealthConnectPermissions,
} from '@/services/healthConnect/healthConnectPermissions';
import * as crashService from '@/services/crashService';

describe('healthConnectPermissions', () => {
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

  describe('SESSION_WRITE_PERMISSIONS', () => {
    it('defines write permissions for ExerciseSession and HeartRate', () => {
      expect(SESSION_WRITE_PERMISSIONS).toEqual([
        { accessType: 'write', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'HeartRate' },
      ]);
    });
  });

  describe('hasHealthConnectPermissions', () => {
    it('returns true when empty permissions array is passed', async () => {
      const result = await hasHealthConnectPermissions([]);
      expect(result).toBe(true);
      expect(getGrantedPermissions).not.toHaveBeenCalled();
    });

    it('returns true when all requested permissions are present in granted list', async () => {
      __setGrantedPermissionsList([
        { accessType: 'write', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'Steps' },
      ]);

      const result = await hasHealthConnectPermissions(
        SESSION_WRITE_PERMISSIONS,
      );

      expect(result).toBe(true);
      expect(getGrantedPermissions).toHaveBeenCalled();
    });

    it('returns false when some requested permissions are missing', async () => {
      __setGrantedPermissionsList([
        { accessType: 'write', recordType: 'ExerciseSession' },
      ]);

      const result = await hasHealthConnectPermissions(
        SESSION_WRITE_PERMISSIONS,
      );

      expect(result).toBe(false);
    });

    it('returns false when no permissions are granted', async () => {
      __setGrantedPermissionsList([]);

      const result = await hasHealthConnectPermissions(
        SESSION_WRITE_PERMISSIONS,
      );

      expect(result).toBe(false);
    });

    it('catches thrown error, reports through crashService, and resolves to false', async () => {
      const testError = new Error('getGrantedPermissions failed');
      __setGrantedPermissionsList(testError);
      const reportSpy = jest.spyOn(crashService, 'reportError');

      const result = await hasHealthConnectPermissions(
        SESSION_WRITE_PERMISSIONS,
      );

      expect(result).toBe(false);
      expect(reportSpy).toHaveBeenCalledWith(testError, {
        scope: 'healthConnectPermissions',
      });
    });
  });

  describe('requestHealthConnectPermissions', () => {
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
});
