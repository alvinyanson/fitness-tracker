import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  BleConnectionSnapshot,
  DiscoveredDevice,
  PairedDevice,
} from '@/interfaces/ble';
import { bleService } from '@/services/ble/bleService';
import {
  getLastPairedDevice,
  setLastPairedDevice,
} from '@/services/storage/deviceStorage';
import { HEART_RATE_SERVICE_UUID } from '@/services/ble/gattProfiles';

export interface UseDevicePairingResult {
  connection: BleConnectionSnapshot;
  devices: DiscoveredDevice[];
  pairedDevice: PairedDevice | null;
  isScanning: boolean;
  isAutoReconnecting: boolean;
  scan: () => void;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => void;
  disconnect: () => void;
  unpair: () => void;
  cancelReconnect: () => void;
}

export function useDevicePairing(): UseDevicePairingResult {
  const subscribe = useCallback(
    (listener: (snapshot: BleConnectionSnapshot) => void) =>
      bleService.subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(() => bleService.getSnapshot(), []);
  const connection = useSyncExternalStore(subscribe, getSnapshot);

  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);

  const pendingConnectDeviceIdRef = useRef<string | null>(null);
  const autoReconnectAttemptedRef = useRef(false);

  // Load paired device from storage on mount
  useEffect(() => {
    const stored = getLastPairedDevice();
    if (stored) {
      setPairedDevice(stored);
    }
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    if (autoReconnectAttemptedRef.current) return;
    autoReconnectAttemptedRef.current = true;

    const stored = getLastPairedDevice();
    if (stored && bleService.getSnapshot().state === 'idle') {
      pendingConnectDeviceIdRef.current = stored.id;
      setIsAutoReconnecting(true);
      bleService.connect(stored.id);
    }
  }, []);

  // Reset isAutoReconnecting when connection moves off 'connecting'
  useEffect(() => {
    if (isAutoReconnecting && connection.state !== 'connecting') {
      setIsAutoReconnecting(false);
    }
  }, [connection, isAutoReconnecting]);

  // Persist on connect
  useEffect(() => {
    if (connection.state === 'connected') {
      const device = connection.device;
      setLastPairedDevice({ id: device.id, name: device.name });
      setPairedDevice({ id: device.id, name: device.name });
      pendingConnectDeviceIdRef.current = null;
    }
  }, [connection]);

  // Cleanup: stop scanning on unmount
  useEffect(() => {
    return () => {
      bleService.stopScan();
    };
  }, []);

  const handleDeviceFound = useCallback((device: DiscoveredDevice) => {
    setDevices((prev) => {
      const index = prev.findIndex((d) => d.id === device.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = device;
        return next;
      }
      return [...prev, device];
    });
  }, []);

  const scan = useCallback(() => {
    setDevices([]);
    bleService.startScan(handleDeviceFound, [HEART_RATE_SERVICE_UUID]);
  }, [handleDeviceFound]);

  const stopScan = useCallback(() => {
    bleService.stopScan();
  }, []);

  const connectToDevice = useCallback((deviceId: string) => {
    pendingConnectDeviceIdRef.current = deviceId;
    bleService.connect(deviceId);
  }, []);

  const disconnect = useCallback(() => {
    bleService.disconnect();
  }, []);

  const unpair = useCallback(() => {
    if (bleService.getSnapshot().state === 'connected') {
      bleService.disconnect();
    }
    setLastPairedDevice(null);
    setPairedDevice(null);
  }, []);

  const cancelReconnect = useCallback(() => {
    bleService.cancelConnect();
  }, []);

  const isScanning = connection.state === 'scanning';

  return {
    connection,
    devices,
    pairedDevice,
    isScanning,
    isAutoReconnecting,
    scan,
    stopScan,
    connectToDevice,
    disconnect,
    unpair,
    cancelReconnect,
  };
}
