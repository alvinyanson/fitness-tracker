import {
  type Permission,
  getGrantedPermissions,
  requestPermission,
} from 'react-native-health-connect';
import type { HealthConnectPermissionStatus } from '@/interfaces/healthConnect';
import { reportError } from '@/services/crashService';

export const SESSION_WRITE_PERMISSIONS: Permission[] = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'HeartRate' },
];

export async function hasHealthConnectPermissions(
  permissions: Permission[],
): Promise<boolean> {
  if (permissions.length === 0) {
    return true;
  }

  try {
    const granted = await getGrantedPermissions();
    return permissions.every((requested) =>
      granted.some(
        (g) =>
          'accessType' in g &&
          'recordType' in g &&
          g.accessType === requested.accessType &&
          g.recordType === requested.recordType,
      ),
    );
  } catch (error) {
    reportError(error, { scope: 'healthConnectPermissions' });
    return false;
  }
}

export async function requestHealthConnectPermissions(
  permissions: Permission[],
): Promise<HealthConnectPermissionStatus> {
  if (permissions.length === 0) {
    return 'granted';
  }

  try {
    const granted = await requestPermission(permissions);
    const grantedCount = permissions.filter((requested) =>
      granted.some(
        (g) =>
          g.accessType === requested.accessType &&
          g.recordType === requested.recordType,
      ),
    ).length;

    if (grantedCount === permissions.length) {
      return 'granted';
    }

    if (grantedCount === 0) {
      return 'denied';
    }

    return 'partial';
  } catch (error) {
    reportError(error, { scope: 'healthConnectPermissions' });
    return 'denied';
  }
}
