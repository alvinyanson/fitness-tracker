import type { Device, Subscription } from 'react-native-ble-plx';
import { safeRemoveSubscription } from './bleNativeUtils';

/**
 * Manages active Bluetooth device subscriptions and ensures leak-free cleanup.
 */
export class BleSubscriptionTracker {
  private activeDevice: Device | null = null;
  private activeDisconnectSubscription: Subscription | null = null;
  private readonly activeCharacteristicSubscriptions = new Set<Subscription>();

  get currentDevice(): Device | null {
    return this.activeDevice;
  }

  setDevice(device: Device | null): void {
    this.activeDevice = device;
  }

  setDisconnectSubscription(subscription: Subscription | null): void {
    this.activeDisconnectSubscription = subscription;
  }

  addCharacteristicSubscription(subscription: Subscription): void {
    this.activeCharacteristicSubscriptions.add(subscription);
  }

  removeCharacteristicSubscription(subscription: Subscription): void {
    safeRemoveSubscription(subscription);
    this.activeCharacteristicSubscriptions.delete(subscription);
  }

  cleanupAll(): void {
    if (this.activeDisconnectSubscription) {
      safeRemoveSubscription(this.activeDisconnectSubscription);
      this.activeDisconnectSubscription = null;
    }
    for (const sub of Array.from(this.activeCharacteristicSubscriptions)) {
      safeRemoveSubscription(sub);
    }
    this.activeCharacteristicSubscriptions.clear();
    this.activeDevice = null;
  }
}
