import { useCallback, useSyncExternalStore } from 'react';
import type { BleConnectionSnapshot } from '@/interfaces/ble';
import { getBleService } from '@/services/ble/bleService';

export function useBleConnection(): BleConnectionSnapshot {
  const subscribe = useCallback(
    (listener: (snapshot: BleConnectionSnapshot) => void) =>
      getBleService().subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(() => getBleService().getSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
