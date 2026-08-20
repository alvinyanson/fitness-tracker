import type { BleGateStatus } from '@/interfaces/ble';
import { requestBlePermissions } from './blePermissions';
import { getBleService } from './bleService';

export async function evaluateBlePermissionGate(): Promise<BleGateStatus> {
  const permissionStatus = await requestBlePermissions();

  if (permissionStatus === 'blocked') {
    return 'permissionBlocked';
  }

  if (permissionStatus === 'denied') {
    return 'permissionDenied';
  }

  const adapterStatus = await getBleService().getAdapterStatus();

  if (adapterStatus === 'poweredOff' || adapterStatus === 'unknown') {
    return 'bluetoothOff';
  }

  return 'ready';
}
