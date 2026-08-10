import type { HeartRateSample } from '@/interfaces/heartRate';
import { bleService } from './bleService';
import {
  HEART_RATE_SERVICE_UUID,
  HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
} from './gattProfiles';
import { parseHeartRateMeasurement } from './heartRateMeasurement';

/** Subscribes to Heart Rate Measurement (0x2A37) notifications. */
export function subscribeToHeartRate(
  onSample: (sample: HeartRateSample) => void,
  onError?: (error: Error) => void,
): () => void {
  const onValue = (base64Value: string) => {
    const sample = parseHeartRateMeasurement(base64Value);
    if (sample !== null) {
      onSample(sample);
    }
  };

  const handleError = (error: Error) => {
    if (onError) {
      onError(error);
    }
  };

  return bleService.monitorCharacteristic(
    HEART_RATE_SERVICE_UUID,
    HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
    onValue,
    handleError,
  );
}
