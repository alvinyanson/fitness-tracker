/** Whether the app can currently write to Health Connect. */
export type HealthConnectAvailability =
  'available' | 'needs-install' | 'needs-update' | 'unsupported';

/** Outcome of requesting a set of Health Connect record-type permissions. */
export type HealthConnectPermissionStatus = 'granted' | 'partial' | 'denied';
