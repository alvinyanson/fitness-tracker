import type { BleManager, Subscription } from 'react-native-ble-plx';

export function safeStopScan(manager: BleManager): void {
  try {
    manager.stopDeviceScan();
  } catch {}
}

export function safeCancelDeviceConnection(
  manager: BleManager,
  deviceId: string,
): void {
  try {
    manager.cancelDeviceConnection(deviceId).catch(() => {});
  } catch {}
}

export function safeRemoveSubscription(
  subscription: Subscription | null | undefined,
): void {
  if (!subscription) return;
  try {
    subscription.remove();
  } catch {}
}
