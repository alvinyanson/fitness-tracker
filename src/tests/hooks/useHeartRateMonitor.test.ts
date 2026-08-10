import { act, renderHook } from '@testing-library/react-native';
import type { BleManager } from 'react-native-ble-plx';
import { useHeartRateMonitor } from '@/hooks/useHeartRateMonitor';
import { bleService } from '@/services/ble/bleService';
import { HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID } from '@/services/ble/gattProfiles';

describe('useHeartRateMonitor', () => {
  let managerInstance: BleManager;

  beforeEach(() => {
    bleService.destroy();
    managerInstance = (bleService as any).manager;
  });

  afterEach(() => {
    bleService.destroy();
  });

  it('returns null sample initially when disconnected', async () => {
    expect(bleService.getSnapshot().state).toBe('idle');
    const { result } = await renderHook(() => useHeartRateMonitor());

    expect(result.current.sample).toBeNull();
  });

  it('subscribes on connect and updates sample on notification, resets to null on disconnect', async () => {
    const { result } = await renderHook(() => useHeartRateMonitor());
    expect(result.current.sample).toBeNull();

    // Connect device
    managerInstance.__connectOutcome('success');
    await act(async () => {
      await bleService.connect('dev-1');
    });

    // Emit notification for 80 bpm ("AFA=")
    await act(async () => {
      managerInstance.__emitNotification(
        HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
        'AFA=',
      );
    });

    expect(result.current.sample).toEqual({
      bpm: 80,
      sensorContact: 'notSupported',
      timestamp: expect.any(Number),
    });

    // Disconnect device
    await act(async () => {
      await bleService.disconnect();
    });

    expect(result.current.sample).toBeNull();
  });

  it('unsubscribes on unmount without leaking listeners across cycles', async () => {
    managerInstance.__connectOutcome('success');
    await act(async () => {
      await bleService.connect('dev-1');
    });

    const { result, unmount } = await renderHook(() => useHeartRateMonitor());

    await act(async () => {
      managerInstance.__emitNotification(
        HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
        'AFA=',
      );
    });
    expect(result.current.sample?.bpm).toBe(80);

    // Unmount hook
    await act(async () => {
      await unmount();
    });

    // Verify BLE notification listener was removed from managerInstance
    const notificationListeners = (managerInstance as any)
      .notificationListeners;
    expect(notificationListeners.size).toBe(0);
  });
});
