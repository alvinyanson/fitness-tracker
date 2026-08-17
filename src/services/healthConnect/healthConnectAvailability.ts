import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { HealthConnectAvailability } from '@/interfaces/healthConnect';
import { reportError } from '@/services/crashService';

export async function getHealthConnectAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== 'android') {
    return 'unsupported';
  }

  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);

  if (version < 28) {
    return 'unsupported';
  }

  try {
    const status = await getSdkStatus();

    if (
      status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    ) {
      return 'needs-update';
    }

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return 'needs-install';
    }

    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      const initialized = await initialize();
      return initialized ? 'available' : 'needs-install';
    }

    return 'unsupported';
  } catch (error) {
    reportError(error, { scope: 'healthConnectAvailability' });
    return 'unsupported';
  }
}
