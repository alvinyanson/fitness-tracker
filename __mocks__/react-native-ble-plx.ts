export type ScriptedScanResult = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type Characteristic = { uuid: string; value: string | null };

export type Subscription = { remove(): void };

export enum State {
  Unknown = 'Unknown',
  PoweredOn = 'PoweredOn',
  PoweredOff = 'PoweredOff',
}

declare module 'react-native-ble-plx' {
  interface BleManager {
    __scanResults(results: ScriptedScanResult[]): void;
    __connectOutcome(outcome: 'success' | { error: Error }): void;
    __emitNotification(characteristicUUID: string, base64Value: string): void;
    __emitDisconnect(error?: Error): void;
  }
}

type NotificationItem = {
  serviceUUID: string;
  characteristicUUID: string;
  listener: (
    error: Error | null,
    characteristic: Characteristic | null,
  ) => void;
};

type DisconnectItem = {
  device: Device;
  listener: (error: Error | null, device: Device) => void;
};

export class Device {
  id: string;
  name: string | null;
  rssi: number | null;
  private manager: BleManager;

  constructor(
    id: string,
    name: string | null = null,
    rssi: number | null = null,
    manager: BleManager,
  ) {
    this.id = id;
    this.name = name;
    this.rssi = rssi;
    this.manager = manager;
  }

  async discoverAllServicesAndCharacteristics(): Promise<Device> {
    return this;
  }

  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (
      error: Error | null,
      characteristic: Characteristic | null,
    ) => void,
  ): Subscription {
    return this.manager._registerNotificationListener(
      this.id,
      serviceUUID,
      characteristicUUID,
      listener,
    );
  }

  onDisconnected(
    listener: (error: Error | null, device: Device) => void,
  ): Subscription {
    return this.manager._registerDisconnectListener(this.id, this, listener);
  }
}

export class BleManager {
  private queuedScanResults: ScriptedScanResult[] = [];
  private scanListener:
    ((error: Error | null, device: Device | null) => void) | null = null;
  private connectOutcomeState: 'success' | { error: Error } = 'success';
  private notificationListeners = new Set<NotificationItem>();
  private disconnectListeners = new Set<DisconnectItem>();
  private devicesById = new Map<string, Device>();

  __scanResults(results: ScriptedScanResult[]): void {
    this.queuedScanResults = [...results];
    if (this.scanListener) {
      this._flushScanResults();
    }
  }

  __connectOutcome(outcome: 'success' | { error: Error }): void {
    this.connectOutcomeState = outcome;
  }

  __emitNotification(characteristicUUID: string, base64Value: string): void {
    const char: Characteristic = {
      uuid: characteristicUUID,
      value: base64Value,
    };
    for (const item of this.notificationListeners) {
      if (
        item.characteristicUUID.toLowerCase() ===
        characteristicUUID.toLowerCase()
      ) {
        item.listener(null, char);
      }
    }
  }

  __emitDisconnect(error?: Error): void {
    const listeners = Array.from(this.disconnectListeners);
    for (const item of listeners) {
      item.listener(error ?? null, item.device);
    }
  }

  startDeviceScan(
    _serviceUUIDs: string[] | null,
    _options: unknown,
    listener: (error: Error | null, device: Device | null) => void,
  ): void {
    this.scanListener = listener;
    this._flushScanResults();
  }

  stopDeviceScan(): void {
    this.scanListener = null;
  }

  async connectToDevice(deviceId: string): Promise<Device> {
    if (
      typeof this.connectOutcomeState === 'object' &&
      'error' in this.connectOutcomeState
    ) {
      throw this.connectOutcomeState.error;
    }
    let device = this.devicesById.get(deviceId);
    if (!device) {
      device = new Device(deviceId, null, null, this);
      this.devicesById.set(deviceId, device);
    }
    return device;
  }

  destroy(): void {
    this.scanListener = null;
    this.queuedScanResults = [];
    this.notificationListeners.clear();
    this.disconnectListeners.clear();
    this.devicesById.clear();
  }

  /** @internal */
  _registerNotificationListener(
    _deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    listener: (
      error: Error | null,
      characteristic: Characteristic | null,
    ) => void,
  ): Subscription {
    const item: NotificationItem = {
      serviceUUID,
      characteristicUUID,
      listener,
    };
    this.notificationListeners.add(item);
    return {
      remove: () => {
        this.notificationListeners.delete(item);
      },
    };
  }

  /** @internal */
  _registerDisconnectListener(
    _deviceId: string,
    device: Device,
    listener: (error: Error | null, device: Device) => void,
  ): Subscription {
    const item: DisconnectItem = { device, listener };
    this.disconnectListeners.add(item);
    return {
      remove: () => {
        this.disconnectListeners.delete(item);
      },
    };
  }

  private _flushScanResults(): void {
    if (!this.scanListener) return;
    const results = [...this.queuedScanResults];
    this.queuedScanResults = [];
    for (const res of results) {
      let device = this.devicesById.get(res.id);
      if (!device) {
        device = new Device(res.id, res.name, res.rssi, this);
        this.devicesById.set(res.id, device);
      } else {
        device.name = res.name;
        device.rssi = res.rssi;
      }
      this.scanListener(null, device);
    }
  }
}
