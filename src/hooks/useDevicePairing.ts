import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BleConnectionSnapshot,
  DiscoveredDevice,
  PairedDevice,
} from '@/interfaces/ble';
import { useBleConnection } from '@/hooks/useBleConnection';
import { getBleService } from '@/services/ble/bleService';
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
  const connection = useBleConnection();

  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);

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
    if (stored && getBleService().getSnapshot().state === 'idle') {
      setIsAutoReconnecting(true);
      getBleService().connect(stored.id);
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
    }
  }, [connection]);

  // Cleanup: stop scanning on unmount
  useEffect(() => {
    return () => {
      getBleService().stopScan();
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
    getBleService().startScan(handleDeviceFound, [HEART_RATE_SERVICE_UUID]);
  }, [handleDeviceFound]);

  const stopScan = useCallback(() => {
    getBleService().stopScan();
  }, []);

  const connectToDevice = useCallback((deviceId: string) => {
    getBleService().connect(deviceId);
  }, []);

  const disconnect = useCallback(() => {
    getBleService().disconnect();
  }, []);

  const unpair = useCallback(() => {
    if (getBleService().getSnapshot().state === 'connected') {
      getBleService().disconnect();
    }
    setLastPairedDevice(null);
    setPairedDevice(null);
  }, []);

  const cancelReconnect = useCallback(() => {
    getBleService().cancelConnect();
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
