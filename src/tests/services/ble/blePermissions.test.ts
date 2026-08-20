import { PermissionsAndroid, Platform } from 'react-native';
import {
  mapMultiPermissionResult,
  mapSinglePermissionResult,
  requestBlePermissions,
} from '@/services/ble/blePermissions';

describe('blePermissions pure mappers', () => {
  describe('mapMultiPermissionResult', () => {
    it('returns blocked if any permission is never_ask_again', () => {
      expect(
        mapMultiPermissionResult({
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
            PermissionsAndroid.RESULTS.GRANTED,
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        }),
      ).toBe('blocked');
    });

    it('returns denied if any permission is denied', () => {
      expect(
        mapMultiPermissionResult({
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
            PermissionsAndroid.RESULTS.DENIED,
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
            PermissionsAndroid.RESULTS.GRANTED,
        }),
      ).toBe('denied');
    });

    it('returns granted when both scan and connect are granted', () => {
      expect(
        mapMultiPermissionResult({
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
            PermissionsAndroid.RESULTS.GRANTED,
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
            PermissionsAndroid.RESULTS.GRANTED,
        }),
      ).toBe('granted');
    });

    it('returns denied when scan or connect is missing or not granted', () => {
      expect(
        mapMultiPermissionResult({
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
            PermissionsAndroid.RESULTS.GRANTED,
        }),
      ).toBe('denied');
    });
  });

  describe('mapSinglePermissionResult', () => {
    it('returns granted when result is granted', () => {
      expect(
        mapSinglePermissionResult(PermissionsAndroid.RESULTS.GRANTED),
      ).toBe('granted');
    });

    it('returns blocked when result is never_ask_again', () => {
      expect(
        mapSinglePermissionResult(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN),
      ).toBe('blocked');
    });

    it('returns denied when result is denied', () => {
      expect(mapSinglePermissionResult(PermissionsAndroid.RESULTS.DENIED)).toBe(
        'denied',
      );
    });
  });
});

describe('requestBlePermissions', () => {
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

  afterEach(() => {
    setPlatform(originalPlatformOS, originalPlatformVersion);
    jest.restoreAllMocks();
  });

  describe('on non-Android platforms', () => {
    it('returns granted immediately without calling PermissionsAndroid', async () => {
      setPlatform('ios', 15);
      const requestSpy = jest.spyOn(PermissionsAndroid, 'request');
      const requestMultipleSpy = jest.spyOn(
        PermissionsAndroid,
        'requestMultiple',
      );

      const result = await requestBlePermissions();

      expect(result).toBe('granted');
      expect(requestSpy).not.toHaveBeenCalled();
      expect(requestMultipleSpy).not.toHaveBeenCalled();
    });
  });

  describe('on Android 12+ (API level >= 31)', () => {
    beforeEach(() => {
      setPlatform('android', 31);
    });

    it('requests BLUETOOTH_SCAN and BLUETOOTH_CONNECT, returning granted when both granted', async () => {
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
          PermissionsAndroid.RESULTS.GRANTED,
      } as never);

      const result = await requestBlePermissions();

      expect(result).toBe('granted');
      expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    });

    it('returns denied when one permission is denied and none are never_ask_again', async () => {
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
          PermissionsAndroid.RESULTS.DENIED,
      } as never);

      const result = await requestBlePermissions();

      expect(result).toBe('denied');
    });

    it('returns blocked when any permission is never_ask_again, taking priority over denied', async () => {
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      } as never);

      const result = await requestBlePermissions();

      expect(result).toBe('blocked');
    });
  });

  describe('on Android < 12 (API level < 31)', () => {
    beforeEach(() => {
      setPlatform('android', 29);
    });

    it('requests ACCESS_FINE_LOCATION and returns granted when granted', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await requestBlePermissions();

      expect(result).toBe('granted');
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        expect.objectContaining({
          title: 'Location Permission',
        }),
      );
    });

    it('returns denied when ACCESS_FINE_LOCATION is denied', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const result = await requestBlePermissions();

      expect(result).toBe('denied');
    });

    it('returns blocked when ACCESS_FINE_LOCATION is never_ask_again', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

      const result = await requestBlePermissions();

      expect(result).toBe('blocked');
    });
  });
});
