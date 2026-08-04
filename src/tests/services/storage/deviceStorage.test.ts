import { createMMKV } from 'react-native-mmkv';
import {
  getLastPairedDevice,
  setLastPairedDevice,
} from '@/services/storage/deviceStorage';
import { PairedDevice } from '@/interfaces/storage';

describe('deviceStorage', () => {
  beforeEach(() => {
    createMMKV().clearAll();
  });

  it('returns null when no device has been stored', () => {
    expect(getLastPairedDevice()).toBeNull();
  });

  it('stores and retrieves the last paired device', () => {
    const device: PairedDevice = {
      id: 'HR-MONITOR-01',
      name: 'Polar H10',
    };

    setLastPairedDevice(device);
    expect(getLastPairedDevice()).toEqual(device);
  });

  it('removes the underlying key when setLastPairedDevice(null) is called', () => {
    const device: PairedDevice = {
      id: 'HR-MONITOR-01',
      name: 'Polar H10',
    };

    setLastPairedDevice(device);
    expect(getLastPairedDevice()).toEqual(device);

    setLastPairedDevice(null);
    expect(getLastPairedDevice()).toBeNull();

    // Verify key was removed from MMKV rather than storing literal null
    const mmkv = createMMKV();
    expect(
      mmkv.getString('@fitness_tracker/last-paired-device'),
    ).toBeUndefined();
  });
});
