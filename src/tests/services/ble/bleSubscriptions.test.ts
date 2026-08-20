import type { Device, Subscription } from 'react-native-ble-plx';
import { BleSubscriptionTracker } from '@/services/ble/bleSubscriptions';

describe('BleSubscriptionTracker', () => {
  let tracker: BleSubscriptionTracker;

  beforeEach(() => {
    tracker = new BleSubscriptionTracker();
  });

  it('manages currentDevice correctly', () => {
    expect(tracker.currentDevice).toBeNull();
    const mockDevice = { id: 'dev-1', name: 'Test' } as unknown as Device;
    tracker.setDevice(mockDevice);
    expect(tracker.currentDevice).toBe(mockDevice);
    tracker.setDevice(null);
    expect(tracker.currentDevice).toBeNull();
  });

  it('removes characteristic subscription individually', () => {
    const removeFn = jest.fn();
    const mockSub: Subscription = { remove: removeFn };

    tracker.addCharacteristicSubscription(mockSub);
    tracker.removeCharacteristicSubscription(mockSub);

    expect(removeFn).toHaveBeenCalledTimes(1);
  });

  it('cleanupAll cleans up disconnect subscription and all characteristic subscriptions', () => {
    const disconnectRemoveFn = jest.fn();
    const mockDisconnectSub: Subscription = { remove: disconnectRemoveFn };

    const charRemove1 = jest.fn();
    const mockCharSub1: Subscription = { remove: charRemove1 };

    const charRemove2 = jest.fn();
    const mockCharSub2: Subscription = { remove: charRemove2 };

    const mockDevice = { id: 'dev-1' } as unknown as Device;

    tracker.setDevice(mockDevice);
    tracker.setDisconnectSubscription(mockDisconnectSub);
    tracker.addCharacteristicSubscription(mockCharSub1);
    tracker.addCharacteristicSubscription(mockCharSub2);

    tracker.cleanupAll();

    expect(disconnectRemoveFn).toHaveBeenCalledTimes(1);
    expect(charRemove1).toHaveBeenCalledTimes(1);
    expect(charRemove2).toHaveBeenCalledTimes(1);
    expect(tracker.currentDevice).toBeNull();
  });

  it('cleanupAll is safe when no subscriptions exist', () => {
    expect(() => {
      tracker.cleanupAll();
    }).not.toThrow();
  });
});
