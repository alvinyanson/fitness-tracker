import { BleManager, State } from 'react-native-ble-plx';
import type { BleConnectionSnapshot } from '@/interfaces/ble';
import { BleService } from '@/services/ble/bleService';

describe('BleService', () => {
  let service: BleService;
  let managerInstance: BleManager;

  beforeEach(() => {
    jest.useFakeTimers();
    // Instantiating BleService creates a new BleManager under the hood
    service = new BleService({ scanTimeoutMs: 15000, connectTimeoutMs: 10000 });
    managerInstance = (service as any).manager;
  });

  afterEach(() => {
    service.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts in idle state', () => {
    expect(service.getSnapshot()).toEqual({ state: 'idle' });
  });

  it('scans and times out when no devices found', () => {
    const stopScanSpy = jest.spyOn(managerInstance, 'stopDeviceScan');
    const snapshots: BleConnectionSnapshot[] = [];
    service.subscribe((s) => snapshots.push(s));

    const onDeviceFound = jest.fn();
    service.startScan(onDeviceFound);

    expect(service.getSnapshot()).toEqual({ state: 'scanning' });
    expect(onDeviceFound).not.toHaveBeenCalled();

    // Advance fake timers past 15000ms
    jest.advanceTimersByTime(15000);

    expect(stopScanSpy).toHaveBeenCalled();
    expect(service.getSnapshot()).toEqual({
      state: 'error',
      cause: 'scanTimeout',
      message: 'BLE scan timed out',
    });
    expect(snapshots).toEqual([
      { state: 'scanning' },
      {
        state: 'error',
        cause: 'scanTimeout',
        message: 'BLE scan timed out',
      },
    ]);
  });

  it('surfaces found devices via startScan callback without changing connection snapshot', () => {
    managerInstance.__scanResults([
      { id: 'dev-1', name: 'Heart Rate Monitor', rssi: -60 },
    ]);

    const onDeviceFound = jest.fn();
    service.startScan(onDeviceFound);

    expect(onDeviceFound).toHaveBeenCalledWith({
      id: 'dev-1',
      name: 'Heart Rate Monitor',
      rssi: -60,
    });
    expect(service.getSnapshot()).toEqual({ state: 'scanning' });

    service.stopScan();
    expect(service.getSnapshot()).toEqual({ state: 'idle' });
  });

  it('times out connect attempt when scripted pending', async () => {
    const cancelConnectSpy = jest.spyOn(
      managerInstance,
      'cancelDeviceConnection',
    );
    managerInstance.__connectOutcome('pending');

    const connectPromise = service.connect('dev-1');
    expect(service.getSnapshot()).toEqual({
      state: 'connecting',
      deviceId: 'dev-1',
    });

    jest.advanceTimersByTime(10000);
    await connectPromise;

    expect(cancelConnectSpy).toHaveBeenCalledWith('dev-1');
    expect(service.getSnapshot()).toEqual({
      state: 'error',
      cause: 'connectTimeout',
      message: 'Connection attempt timed out',
    });
  });

  it('handles connect rejection when connectToDevice fails', async () => {
    const error = new Error('GATT connection failed');
    managerInstance.__connectOutcome({ error });

    await service.connect('dev-1');

    expect(service.getSnapshot()).toEqual({
      state: 'error',
      cause: 'connectRejected',
      message: 'GATT connection failed',
    });
  });

  it('transitions to connected on successful connect', async () => {
    managerInstance.__connectOutcome('success');

    await service.connect('dev-1');

    expect(service.getSnapshot()).toEqual({
      state: 'connected',
      device: { id: 'dev-1', name: null },
    });
  });

  it('handles adapter powered off mid-scan', () => {
    const stopScanSpy = jest.spyOn(managerInstance, 'stopDeviceScan');
    service.startScan(jest.fn());
    expect(service.getSnapshot()).toEqual({ state: 'scanning' });

    managerInstance.__setAdapterState(State.PoweredOff);

    expect(stopScanSpy).toHaveBeenCalled();
    expect(service.getSnapshot()).toEqual({
      state: 'error',
      cause: 'adapterOff',
      message: 'Bluetooth adapter is powered off',
    });
  });

  it('handles adapter powered off mid-connect/connected', async () => {
    managerInstance.__connectOutcome('success');
    await service.connect('dev-1');
    expect(service.getSnapshot()).toEqual({
      state: 'connected',
      device: { id: 'dev-1', name: null },
    });

    managerInstance.__setAdapterState(State.PoweredOff);

    expect(service.getSnapshot()).toEqual({
      state: 'error',
      cause: 'adapterOff',
      message: 'Bluetooth adapter is powered off',
    });
  });

  it('handles explicit disconnect vs unexpected disconnect', async () => {
    managerInstance.__connectOutcome('success');

    // Test explicit user-initiated disconnect
    await service.connect('dev-1');
    const explicitSnapshots: BleConnectionSnapshot[] = [];
    const unsub = service.subscribe((s) => explicitSnapshots.push(s));

    await service.disconnect();

    expect(service.getSnapshot()).toEqual({
      state: 'disconnected',
      device: { id: 'dev-1', name: null },
      reason: 'userInitiated',
    });
    // Should emit exactly ONE disconnected snapshot notification
    expect(explicitSnapshots).toEqual([
      {
        state: 'disconnected',
        device: { id: 'dev-1', name: null },
        reason: 'userInitiated',
      },
    ]);
    unsub();

    // Test unexpected disconnect (e.g. device dropped)
    await service.connect('dev-1');
    const unexpectedSnapshots: BleConnectionSnapshot[] = [];
    service.subscribe((s) => unexpectedSnapshots.push(s));

    const mockError = new Error('Out of range');
    managerInstance.__emitDisconnect(mockError);

    expect(service.getSnapshot()).toEqual({
      state: 'disconnected',
      device: { id: 'dev-1', name: null },
      reason: 'unexpected',
    });
    expect(unexpectedSnapshots).toEqual([
      {
        state: 'disconnected',
        device: { id: 'dev-1', name: null },
        reason: 'unexpected',
      },
    ]);
  });

  it('leaves exactly one live notification callback and no duplicate disconnect listeners after 3 consecutive cycles', async () => {
    managerInstance.__connectOutcome('success');

    const notificationValues: string[] = [];

    // Cycle 1
    await service.connect('dev-1');
    service.monitorCharacteristic(
      '180d',
      '2a37',
      (val) => notificationValues.push(val),
      jest.fn(),
    );
    await service.disconnect();

    // Cycle 2
    await service.connect('dev-1');
    service.monitorCharacteristic(
      '180d',
      '2a37',
      (val) => notificationValues.push(val),
      jest.fn(),
    );
    await service.disconnect();

    // Cycle 3
    await service.connect('dev-1');
    service.monitorCharacteristic(
      '180d',
      '2a37',
      (val) => notificationValues.push(val),
      jest.fn(),
    );

    // Emit notification once
    managerInstance.__emitNotification('2a37', 'BPM_80');

    // Callback should fire exactly once for the latest active subscription
    expect(notificationValues).toEqual(['BPM_80']);

    // Emit unexpected disconnect once
    const snapshotHistory: BleConnectionSnapshot[] = [];
    service.subscribe((s) => snapshotHistory.push(s));

    managerInstance.__emitDisconnect(new Error('Dropped'));

    // Should receive only one disconnected notification
    expect(snapshotHistory).toEqual([
      {
        state: 'disconnected',
        device: { id: 'dev-1', name: null },
        reason: 'unexpected',
      },
    ]);
  });

  it('throws error if monitorCharacteristic called when not connected', () => {
    expect(() => {
      service.monitorCharacteristic('180d', '2a37', jest.fn(), jest.fn());
    }).toThrow('Cannot monitor characteristic when not connected');
  });

  it('destroy() clears timers, removes adapter listener, and resets snapshot to idle', async () => {
    managerInstance.__connectOutcome('success');
    await service.connect('dev-1');
    expect(service.getSnapshot().state).toBe('connected');

    const listenerSpy = jest.fn();
    service.subscribe(listenerSpy);

    service.destroy();

    expect(service.getSnapshot()).toEqual({ state: 'idle' });

    // Listener was cleared, so adapter changes after destroy do not notify subscriber
    managerInstance.__setAdapterState(State.PoweredOff);
    expect(listenerSpy).not.toHaveBeenCalled();
  });
});
