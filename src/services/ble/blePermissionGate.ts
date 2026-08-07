import { BleGateStatus } from '@/interfaces/ble';
import { requestBlePermissions } from './blePermissions';
import { getBluetoothAdapterStatus } from './bluetoothAdapter';

export async function evaluateBlePermissionGate(): Promise<BleGateStatus> {
  const permissionStatus = await requestBlePermissions();

  if (permissionStatus === 'blocked') {
    return 'permissionBlocked';
  }

  if (permissionStatus === 'denied') {
    return 'permissionDenied';
  }

  const adapterStatus = await getBluetoothAdapterStatus();

  if (adapterStatus === 'poweredOff' || adapterStatus === 'unknown') {
    return 'bluetoothOff';
  }

  return 'ready';
}
