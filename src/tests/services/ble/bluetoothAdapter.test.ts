import { State } from 'react-native-ble-plx';
import { toBluetoothAdapterStatus } from '@/services/ble/bluetoothAdapter';

describe('toBluetoothAdapterStatus', () => {
  it('returns poweredOn when state is PoweredOn', () => {
    expect(toBluetoothAdapterStatus(State.PoweredOn)).toBe('poweredOn');
  });

  it('returns poweredOff when state is PoweredOff', () => {
    expect(toBluetoothAdapterStatus(State.PoweredOff)).toBe('poweredOff');
  });

  it('returns unknown when state is Unknown, Unauthorized, or Resetting', () => {
    expect(toBluetoothAdapterStatus(State.Unknown)).toBe('unknown');
    expect(toBluetoothAdapterStatus(State.Unauthorized)).toBe('unknown');
    expect(toBluetoothAdapterStatus(State.Resetting)).toBe('unknown');
  });
});
