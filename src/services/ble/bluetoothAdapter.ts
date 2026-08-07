import { BleManager, State } from 'react-native-ble-plx';
import { BluetoothAdapterStatus } from '@/interfaces/ble';

export async function getBluetoothAdapterStatus(): Promise<BluetoothAdapterStatus> {
  const manager = new BleManager();
  try {
    const state = await manager.state();
    if (state === State.PoweredOn) {
      return 'poweredOn';
    }
    if (state === State.PoweredOff) {
      return 'poweredOff';
    }
    return 'unknown';
  } finally {
    manager.destroy();
  }
}
