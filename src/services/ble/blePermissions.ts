import {
  PermissionsAndroid,
  Platform,
  type PermissionStatus,
} from 'react-native';
import type { BlePermissionStatus } from '@/interfaces/ble';

export function mapMultiPermissionResult(
  results: Record<string, PermissionStatus>,
): BlePermissionStatus {
  const statuses = Object.values(results);

  if (statuses.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
    return 'blocked';
  }

  if (statuses.includes(PermissionsAndroid.RESULTS.DENIED)) {
    return 'denied';
  }

  const scanStatus = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN];
  const connectStatus =
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];

  if (
    scanStatus === PermissionsAndroid.RESULTS.GRANTED &&
    connectStatus === PermissionsAndroid.RESULTS.GRANTED
  ) {
    return 'granted';
  }

  return 'denied';
}

export function mapSinglePermissionResult(
  result: PermissionStatus,
): BlePermissionStatus {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }

  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return 'blocked';
  }

  return 'denied';
}

export async function requestBlePermissions(): Promise<BlePermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);

  if (version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return mapMultiPermissionResult(results);
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message:
        'Bluetooth Low Energy scanning requires Location access on this version of Android.',
      buttonPositive: 'OK',
      buttonNegative: 'Cancel',
    },
  );

  return mapSinglePermissionResult(result);
}
