import type { BleManager, Subscription } from 'react-native-ble-plx';
import { reportError } from '@/services/crashService';

export function safeStopScan(manager: BleManager): void {
  try {
    manager.stopDeviceScan();
  } catch (error) {
    reportError(error, { scope: 'safeStopScan' });
  }
}

export function safeCancelDeviceConnection(
  manager: BleManager,
  deviceId: string,
): void {
  try {
    manager.cancelDeviceConnection(deviceId).catch((error) => {
      reportError(error, { scope: 'safeCancelDeviceConnection', deviceId });
    });
  } catch (error) {
    reportError(error, { scope: 'safeCancelDeviceConnection', deviceId });
  }
}

export function safeRemoveSubscription(
  subscription: Subscription | null | undefined,
): void {
  if (!subscription) return;
  try {
    subscription.remove();
  } catch (error) {
    reportError(error, { scope: 'safeRemoveSubscription' });
  }
}
