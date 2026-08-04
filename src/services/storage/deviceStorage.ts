import { PairedDevice } from '@/interfaces/storage';
import { getItem, setItem, removeItem } from '@/services/storage/mmkvStorage';

const LAST_PAIRED_DEVICE_KEY = '@fitness_tracker/last-paired-device';

export function getLastPairedDevice(): PairedDevice | null {
  return getItem<PairedDevice>(LAST_PAIRED_DEVICE_KEY);
}

export function setLastPairedDevice(device: PairedDevice | null): void {
  if (device === null) {
    removeItem(LAST_PAIRED_DEVICE_KEY);
  } else {
    setItem(LAST_PAIRED_DEVICE_KEY, device);
  }
}
