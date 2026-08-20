import type { BleManager } from 'react-native-ble-plx';
import type { HeartRateSample } from '@/interfaces/heartRate';
import { getBleService, resetBleService } from '@/services/ble/bleService';
import { HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID } from '@/services/ble/gattProfiles';
import { subscribeToHeartRate } from '@/services/ble/heartRateMonitor';

describe('subscribeToHeartRate', () => {
  let managerInstance: BleManager;

  beforeEach(() => {
    resetBleService();
    managerInstance = (getBleService() as any).manager;
  });

  afterEach(() => {
    resetBleService();
  });

  it('delivers successfully decoded samples to onSample', async () => {
    managerInstance.__connectOutcome('success');
    await getBleService().connect('dev-1');

    const samples: HeartRateSample[] = [];
    const onSample = jest.fn((s: HeartRateSample) => samples.push(s));
    const onError = jest.fn();

    const unsub = subscribeToHeartRate(onSample, onError);

    // Base64 for uint8 BPM 80: [0x00, 80] -> "AFA="
    managerInstance.__emitNotification(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
      'AFA=',
    );

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      bpm: 80,
      sensorContact: 'notSupported',
      timestamp: expect.any(Number),
    });

    unsub();
  });

  it('silently drops malformed notifications without calling onSample or onError', async () => {
    managerInstance.__connectOutcome('success');
    await getBleService().connect('dev-1');

    const onSample = jest.fn();
    const onError = jest.fn();

    const unsub = subscribeToHeartRate(onSample, onError);

    // Invalid base64
    managerInstance.__emitNotification(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
      'InvalidBase64!!!',
    );
    // Truncated payload (flag 0x01 requires 3 bytes, only 2 provided)
    managerInstance.__emitNotification(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
      'ASw=',
    );

    expect(onSample).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    unsub();
  });

  it('calling the returned unsubscribe function stops further delivery', async () => {
    managerInstance.__connectOutcome('success');
    await getBleService().connect('dev-1');

    const onSample = jest.fn();
    const unsub = subscribeToHeartRate(onSample);

    managerInstance.__emitNotification(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
      'AFA=',
    );
    expect(onSample).toHaveBeenCalledTimes(1);

    unsub();

    managerInstance.__emitNotification(
      HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
      'AFA=',
    );
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it('throws the same error as monitorCharacteristic when called while not connected', () => {
    expect(getBleService().getSnapshot().state).toBe('idle');

    expect(() => {
      subscribeToHeartRate(jest.fn());
    }).toThrow('Cannot monitor characteristic when not connected');
  });
});
