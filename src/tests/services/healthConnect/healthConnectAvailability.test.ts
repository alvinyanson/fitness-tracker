import { Platform } from 'react-native';
import {
  SdkAvailabilityStatus,
  getSdkStatus,
  initialize,
  __setSdkStatus,
  __setInitializeResult,
  __resetMocks,
} from 'react-native-health-connect';
import { getHealthConnectAvailability } from '@/services/healthConnect/healthConnectAvailability';
import * as crashService from '@/services/crashService';

describe('getHealthConnectAvailability', () => {
  const originalPlatformOS = Platform.OS;
  const originalPlatformVersion = Platform.Version;

  function setPlatform(os: typeof Platform.OS, version: number | string) {
    Object.defineProperty(Platform, 'OS', {
      get: () => os,
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      get: () => version,
      configurable: true,
    });
  }

  beforeEach(() => {
    __resetMocks();
    setPlatform('android', 34);
    jest.clearAllMocks();
  });

  afterEach(() => {
    setPlatform(originalPlatformOS, originalPlatformVersion);
    jest.restoreAllMocks();
  });

  it('returns unsupported immediately on non-Android platforms without calling native SDK', async () => {
    setPlatform('ios', 17);

    const result = await getHealthConnectAvailability();

    expect(result).toBe('unsupported');
    expect(getSdkStatus).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });

  it('returns unsupported on Android with API level < 28 without calling native SDK', async () => {
    setPlatform('android', 27);

    const result = await getHealthConnectAvailability();

    expect(result).toBe('unsupported');
    expect(getSdkStatus).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });

  it('maps SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED to needs-update', async () => {
    __setSdkStatus(
      SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED,
    );

    const result = await getHealthConnectAvailability();

    expect(result).toBe('needs-update');
    expect(getSdkStatus).toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });

  it('maps SDK_UNAVAILABLE to needs-install', async () => {
    __setSdkStatus(SdkAvailabilityStatus.SDK_UNAVAILABLE);

    const result = await getHealthConnectAvailability();

    expect(result).toBe('needs-install');
    expect(getSdkStatus).toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });

  it('maps SDK_AVAILABLE with successful initialize to available', async () => {
    __setSdkStatus(SdkAvailabilityStatus.SDK_AVAILABLE);
    __setInitializeResult(true);

    const result = await getHealthConnectAvailability();

    expect(result).toBe('available');
    expect(getSdkStatus).toHaveBeenCalled();
    expect(initialize).toHaveBeenCalled();
  });

  it('maps SDK_AVAILABLE with failed initialize to needs-install', async () => {
    __setSdkStatus(SdkAvailabilityStatus.SDK_AVAILABLE);
    __setInitializeResult(false);

    const result = await getHealthConnectAvailability();

    expect(result).toBe('needs-install');
    expect(getSdkStatus).toHaveBeenCalled();
    expect(initialize).toHaveBeenCalled();
  });

  it('catches getSdkStatus unexpected error, reports via reportError, and resolves unsupported', async () => {
    const testError = new Error('getSdkStatus native crash');
    __setSdkStatus(testError);
    const reportSpy = jest.spyOn(crashService, 'reportError');

    const result = await getHealthConnectAvailability();

    expect(result).toBe('unsupported');
    expect(reportSpy).toHaveBeenCalledWith(testError, {
      scope: 'healthConnectAvailability',
    });
  });

  it('catches initialize unexpected error, reports via reportError, and resolves unsupported', async () => {
    const testError = new Error('initialize native crash');
    __setSdkStatus(SdkAvailabilityStatus.SDK_AVAILABLE);
    __setInitializeResult(testError);
    const reportSpy = jest.spyOn(crashService, 'reportError');

    const result = await getHealthConnectAvailability();

    expect(result).toBe('unsupported');
    expect(reportSpy).toHaveBeenCalledWith(testError, {
      scope: 'healthConnectAvailability',
    });
  });
});
