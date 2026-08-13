import { BleManager, State, Subscription } from 'react-native-ble-plx';
import type {
  BleConnectionSnapshot,
  DiscoveredDevice,
  PairedDevice,
} from '@/interfaces/ble';
import { reportError, logBreadcrumb } from '@/services/crashService';
import {
  type BleConnectionEvent,
  reduceBleConnectionState,
} from './bleConnectionMachine';
import {
  safeCancelDeviceConnection,
  safeRemoveSubscription,
  safeStopScan,
} from './bleNativeUtils';
import { BleSubscriptionTracker } from './bleSubscriptions';

export interface BleServiceOptions {
  scanTimeoutMs?: number; // default 15000
  connectTimeoutMs?: number; // default 10000
}

export class BleService {
  private readonly scanTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly manager: BleManager;
  private readonly subscriptions = new BleSubscriptionTracker();

  private snapshot: BleConnectionSnapshot = { state: 'idle' };
  private readonly listeners = new Set<
    (snapshot: BleConnectionSnapshot) => void
  >();

  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private adapterStateSubscription: Subscription | null = null;
  private isUserInitiatedDisconnect = false;

  constructor(options?: BleServiceOptions) {
    this.scanTimeoutMs = options?.scanTimeoutMs ?? 15000;
    this.connectTimeoutMs = options?.connectTimeoutMs ?? 10000;
    this.manager = new BleManager();

    this.adapterStateSubscription = this.manager.onStateChange((state) => {
      if (state !== State.PoweredOn) {
        this.handleAdapterPowerOff();
      }
    }, true);
  }

  getSnapshot(): BleConnectionSnapshot {
    return this.snapshot;
  }

  getManager(): BleManager {
    return this.manager;
  }

  subscribe(listener: (snapshot: BleConnectionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  startScan(
    onDeviceFound: (device: DiscoveredDevice) => void,
    serviceUUIDs?: string[] | null,
  ): void {
    if (
      this.snapshot.state === 'disconnected' ||
      this.snapshot.state === 'error'
    ) {
      this.dispatch({ type: 'reset' });
    }

    if (this.snapshot.state !== 'idle') return;

    logBreadcrumb('BLE: startScan initiated');
    this.clearScanTimer();
    this.dispatch({ type: 'scanStarted' });
    if (this.getSnapshot().state !== 'scanning') return;

    this.scanTimer = setTimeout(() => {
      if (this.snapshot.state === 'scanning') {
        safeStopScan(this.manager);
        this.dispatch({ type: 'scanTimedOut' });
      }
    }, this.scanTimeoutMs);

    this.manager.startDeviceScan(
      serviceUUIDs ?? null,
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device) return;
        onDeviceFound({
          id: device.id,
          name: device.name ?? null,
          rssi: device.rssi ?? null,
        });
      },
    );
  }

  stopScan(): void {
    if (this.snapshot.state !== 'scanning') return;
    logBreadcrumb('BLE: stopScan initiated');
    this.clearScanTimer();
    safeStopScan(this.manager);
    this.dispatch({ type: 'scanStopped' });
  }

  async connect(deviceId: string): Promise<void> {
    if (this.snapshot.state === 'scanning') {
      this.stopScan();
    }

    logBreadcrumb(`BLE: connect requested for device ${deviceId}`);
    this.dispatch({ type: 'connectRequested', deviceId });
    if (this.snapshot.state !== 'connecting') return;

    this.clearConnectTimer();
    this.isUserInitiatedDisconnect = false;

    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      this.connectTimer = setTimeout(() => {
        timedOut = true;
        reject(new Error('CONNECT_TIMEOUT'));
      }, this.connectTimeoutMs);
    });

    try {
      const device = await Promise.race([
        this.manager.connectToDevice(deviceId, { autoConnect: false }),
        timeoutPromise,
      ]);

      this.clearConnectTimer();
      await device.discoverAllServicesAndCharacteristics();

      if (this.snapshot.state !== 'connecting') return;

      this.subscriptions.setDevice(device);
      const pairedDevice: PairedDevice = {
        id: device.id,
        name: device.name ?? null,
      };

      const disconnectSub = device.onDisconnected((_err, dev) => {
        if (this.isUserInitiatedDisconnect) return;
        logBreadcrumb('BLE: device disconnected unexpectedly');
        this.subscriptions.cleanupAll();
        this.dispatch({
          type: 'disconnected',
          reason: 'unexpected',
          device: { id: dev.id, name: dev.name ?? null },
        });
      });
      this.subscriptions.setDisconnectSubscription(disconnectSub);

      this.dispatch({ type: 'connectSucceeded', device: pairedDevice });
    } catch (err: any) {
      this.clearConnectTimer();
      reportError(err, { scope: 'bleService.connect', deviceId });
      if (timedOut || err?.message === 'CONNECT_TIMEOUT') {
        safeCancelDeviceConnection(this.manager, deviceId);
        if (this.snapshot.state === 'connecting') {
          this.dispatch({ type: 'connectTimedOut' });
        }
      } else if (this.snapshot.state === 'connecting') {
        this.dispatch({
          type: 'connectRejected',
          message: err?.message || 'Connection rejected',
        });
      }
    }
  }

  cancelConnect(): void {
    if (this.snapshot.state !== 'connecting') return;

    const deviceId = this.snapshot.deviceId;
    this.clearConnectTimer();
    safeCancelDeviceConnection(this.manager, deviceId);
    this.dispatch({ type: 'connectCancelled' });
  }

  async disconnect(): Promise<void> {
    if (this.snapshot.state !== 'connected') return;

    this.isUserInitiatedDisconnect = true;
    const deviceId = this.subscriptions.currentDevice?.id;

    this.subscriptions.cleanupAll();
    if (deviceId) {
      safeCancelDeviceConnection(this.manager, deviceId);
    }

    this.dispatch({ type: 'disconnectRequested' });
  }

  monitorCharacteristic(
    serviceUUID: string,
    characteristicUUID: string,
    onValue: (base64Value: string) => void,
    onError: (error: Error) => void,
  ): () => void {
    const activeDevice = this.subscriptions.currentDevice;
    if (this.snapshot.state !== 'connected' || !activeDevice) {
      throw new Error('Cannot monitor characteristic when not connected');
    }

    const subscription = activeDevice.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          onError(error);
        } else if (
          characteristic?.value !== undefined &&
          characteristic.value !== null
        ) {
          onValue(characteristic.value);
        }
      },
    );

    this.subscriptions.addCharacteristicSubscription(subscription);

    return () => {
      this.subscriptions.removeCharacteristicSubscription(subscription);
    };
  }

  destroy(): void {
    this.clearScanTimer();
    this.clearConnectTimer();

    if (this.snapshot.state === 'scanning') {
      safeStopScan(this.manager);
    }

    const deviceId = this.subscriptions.currentDevice?.id;
    this.subscriptions.cleanupAll();

    if (deviceId) {
      safeCancelDeviceConnection(this.manager, deviceId);
    }

    if (this.adapterStateSubscription) {
      safeRemoveSubscription(this.adapterStateSubscription);
      this.adapterStateSubscription = null;
    }

    this.listeners.clear();
    this.snapshot = { state: 'idle' };
  }

  /* ---------------- Private Helpers ---------------- */

  private dispatch(event: BleConnectionEvent): void {
    const next = reduceBleConnectionState(this.snapshot, event);
    if (next === this.snapshot) return;

    this.snapshot = next;
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(this.snapshot);
      } catch (err) {
        reportError(err, { scope: 'bleService.listener' });
      }
    }
  }

  private handleAdapterPowerOff(): void {
    const { state } = this.snapshot;
    if (
      state === 'scanning' ||
      state === 'connecting' ||
      state === 'connected'
    ) {
      this.clearScanTimer();
      this.clearConnectTimer();

      if (state === 'scanning') {
        safeStopScan(this.manager);
      } else {
        const deviceId = this.subscriptions.currentDevice?.id;
        this.subscriptions.cleanupAll();
        if (deviceId) {
          safeCancelDeviceConnection(this.manager, deviceId);
        }
      }

      this.dispatch({ type: 'adapterPoweredOff' });
    }
  }

  private clearScanTimer(): void {
    if (this.scanTimer !== null) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }
}

export const bleService = new BleService();
