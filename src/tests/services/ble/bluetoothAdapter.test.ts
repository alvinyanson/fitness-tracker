import { BleManager, State } from 'react-native-ble-plx';
import { getBluetoothAdapterStatus } from '@/services/ble/bluetoothAdapter';

describe('getBluetoothAdapterStatus', () => {
  let manager: BleManager;

  beforeEach(() => {
    manager = new BleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('returns poweredOn when state is PoweredOn', async () => {
    manager.__setAdapterState(State.PoweredOn);
    const status = await getBluetoothAdapterStatus();
    expect(status).toBe('poweredOn');
  });

  it('returns poweredOff when state is PoweredOff', async () => {
    manager.__setAdapterState(State.PoweredOff);
    const status = await getBluetoothAdapterStatus();
    expect(status).toBe('poweredOff');
  });

  it('returns unknown when state is Unknown or Unauthorized or Resetting', async () => {
    manager.__setAdapterState(State.Unknown);
    let status = await getBluetoothAdapterStatus();
    expect(status).toBe('unknown');

    manager.__setAdapterState(State.Unauthorized);
    status = await getBluetoothAdapterStatus();
    expect(status).toBe('unknown');
  });
});
