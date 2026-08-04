import { BleManager, Device } from 'react-native-ble-plx';

describe('react-native-ble-plx mock', () => {
  it('delivers scripted scan results to the scan listener', () => {
    const manager = new BleManager();
    const scannedDevices: Device[] = [];

    manager.__scanResults([
      { id: 'dev-1', name: 'Heart Rate Monitor', rssi: -55 },
      { id: 'dev-2', name: 'Smart Band', rssi: -70 },
    ]);

    manager.startDeviceScan(null, null, (error, device) => {
      expect(error).toBeNull();
      if (device) {
        scannedDevices.push(device);
      }
    });

    expect(scannedDevices).toHaveLength(2);
    expect(scannedDevices[0].id).toBe('dev-1');
    expect(scannedDevices[0].name).toBe('Heart Rate Monitor');
    expect(scannedDevices[0].rssi).toBe(-55);
    expect(scannedDevices[1].id).toBe('dev-2');
    expect(scannedDevices[1].name).toBe('Smart Band');
    expect(scannedDevices[1].rssi).toBe(-70);
  });

  it('rejects connectToDevice when scripted with a connect failure', async () => {
    const manager = new BleManager();
    const connectError = new Error('Connection timed out');
    manager.__connectOutcome({ error: connectError });

    await expect(manager.connectToDevice('dev-1')).rejects.toThrow(
      'Connection timed out',
    );
  });

  it('fires registered onDisconnected listener on scripted mid-stream disconnect after successful connect', async () => {
    const manager = new BleManager();
    manager.__connectOutcome('success');

    const device = await manager.connectToDevice('dev-1');
    await device.discoverAllServicesAndCharacteristics();

    let notificationValue: string | null = null;
    device.monitorCharacteristicForService(
      '180d',
      '2a37',
      (error, characteristic) => {
        expect(error).toBeNull();
        if (characteristic) {
          notificationValue = characteristic.value;
        }
      },
    );

    manager.__emitNotification('2a37', 'AQAwAAAA');
    expect(notificationValue).toBe('AQAwAAAA');

    let disconnectedDevice: Device | null = null;
    let disconnectError: Error | null = null;

    device.onDisconnected((error, dev) => {
      disconnectError = error;
      disconnectedDevice = dev;
    });

    const mockError = new Error('Peripheral disconnected unexpectedly');
    manager.__emitDisconnect(mockError);

    expect(disconnectedDevice).toBe(device);
    expect(disconnectError).toBe(mockError);
  });
});
