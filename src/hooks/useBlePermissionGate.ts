import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { BleGateStatus } from '@/interfaces/ble';
import { evaluateBlePermissionGate } from '@/services/ble/blePermissionGate';

export function useBlePermissionGate(): {
  status: BleGateStatus;
  retry: () => void;
  openAppSettings: () => void;
} {
  const [status, setStatus] = useState<BleGateStatus>('checking');

  const checkGate = useCallback(async () => {
    setStatus('checking');
    const result = await evaluateBlePermissionGate();
    setStatus(result);
  }, []);

  useEffect(() => {
    checkGate();
  }, [checkGate]);

  const openAppSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return {
    status,
    retry: checkGate,
    openAppSettings,
  };
}
