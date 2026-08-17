import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { Permission } from 'react-native-health-connect';
import type {
  HealthConnectAvailability,
  HealthConnectPermissionStatus,
} from '@/interfaces/healthConnect';
import { getHealthConnectAvailability } from '@/services/healthConnect/healthConnectAvailability';
import { requestHealthConnectPermissions } from '@/services/healthConnect/healthConnectPermissions';

export const HEALTH_CONNECT_MARKET_URI =
  'market://details?id=com.google.android.apps.healthdata';
export const HEALTH_CONNECT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export function useHealthConnectAvailability(): {
  availability: HealthConnectAvailability | 'checking';
  retry: () => void;
  requestPermissions: (
    permissions: Permission[],
  ) => Promise<HealthConnectPermissionStatus>;
  openPlayStoreListing: () => void;
} {
  const [availability, setAvailability] = useState<
    HealthConnectAvailability | 'checking'
  >('checking');

  const checkAvailability = useCallback(async () => {
    setAvailability('checking');
    const result = await getHealthConnectAvailability();
    setAvailability(result);
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const requestPermissions = useCallback(
    async (
      permissions: Permission[],
    ): Promise<HealthConnectPermissionStatus> => {
      return requestHealthConnectPermissions(permissions);
    },
    [],
  );

  const openPlayStoreListing = useCallback(async () => {
    try {
      const canOpenMarket = await Linking.canOpenURL(HEALTH_CONNECT_MARKET_URI);
      if (canOpenMarket) {
        await Linking.openURL(HEALTH_CONNECT_MARKET_URI);
      } else {
        await Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL);
      }
    } catch {
      try {
        await Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL);
      } catch {
        // Safe fallback
      }
    }
  }, []);

  return {
    availability,
    retry: checkAvailability,
    requestPermissions,
    openPlayStoreListing,
  };
}
