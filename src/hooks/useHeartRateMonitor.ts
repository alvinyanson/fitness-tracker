import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { BleConnectionSnapshot } from '@/interfaces/ble';
import type { HeartRateSample } from '@/interfaces/heartRate';
import { bleService } from '@/services/ble/bleService';
import { subscribeToHeartRate } from '@/services/ble/heartRateMonitor';

export interface UseHeartRateMonitorResult {
  sample: HeartRateSample | null;
}

/** Hook exposing live decoded Heart Rate samples. */
export function useHeartRateMonitor(): UseHeartRateMonitorResult {
  const subscribe = useCallback(
    (listener: (snapshot: BleConnectionSnapshot) => void) =>
      bleService.subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(() => bleService.getSnapshot(), []);
  const connection = useSyncExternalStore(subscribe, getSnapshot);

  const [sample, setSample] = useState<HeartRateSample | null>(null);

  const isConnected = connection.state === 'connected';
  const deviceId = isConnected ? connection.device.id : null;

  useEffect(() => {
    if (!isConnected || !deviceId) {
      setSample(null);
      return;
    }

    const unsubscribe = subscribeToHeartRate((newSample) => {
      setSample(newSample);
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, deviceId]);

  return { sample };
}
