import { BleManager, State } from 'react-native-ble-plx';
import { BluetoothAdapterStatus } from '@/interfaces/ble';
import { bleService } from './bleService';

export async function getBluetoothAdapterStatus(
  manager?: BleManager,
): Promise<BluetoothAdapterStatus> {
  const m = manager ?? bleService.getManager();
  const state = await m.state();
  if (state === State.PoweredOn) {
    return 'poweredOn';
  }
  if (state === State.PoweredOff) {
    return 'poweredOff';
  }
  return 'unknown';
}
