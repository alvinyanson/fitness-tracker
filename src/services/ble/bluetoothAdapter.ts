import { State } from 'react-native-ble-plx';
import type { BluetoothAdapterStatus } from '@/interfaces/ble';

export function toBluetoothAdapterStatus(state: State): BluetoothAdapterStatus {
  if (state === State.PoweredOn) {
    return 'poweredOn';
  }
  if (state === State.PoweredOff) {
    return 'poweredOff';
  }
  return 'unknown';
}
