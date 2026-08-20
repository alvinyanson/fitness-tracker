import { evaluateBlePermissionGate } from '@/services/ble/blePermissionGate';
import * as blePermissionsModule from '@/services/ble/blePermissions';
import { getBleService } from '@/services/ble/bleService';

describe('evaluateBlePermissionGate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns permissionBlocked and skips adapter check when permissions are blocked', async () => {
    jest
      .spyOn(blePermissionsModule, 'requestBlePermissions')
      .mockResolvedValue('blocked');
    const adapterSpy = jest.spyOn(getBleService(), 'getAdapterStatus');

    const status = await evaluateBlePermissionGate();

    expect(status).toBe('permissionBlocked');
    expect(adapterSpy).not.toHaveBeenCalled();
  });

  it('returns permissionDenied and skips adapter check when permissions are denied', async () => {
    jest
      .spyOn(blePermissionsModule, 'requestBlePermissions')
      .mockResolvedValue('denied');
    const adapterSpy = jest.spyOn(getBleService(), 'getAdapterStatus');

    const status = await evaluateBlePermissionGate();

    expect(status).toBe('permissionDenied');
    expect(adapterSpy).not.toHaveBeenCalled();
  });

  it('returns bluetoothOff when permissions granted but adapter is poweredOff', async () => {
    jest
      .spyOn(blePermissionsModule, 'requestBlePermissions')
      .mockResolvedValue('granted');
    jest
      .spyOn(getBleService(), 'getAdapterStatus')
      .mockResolvedValue('poweredOff');

    const status = await evaluateBlePermissionGate();

    expect(status).toBe('bluetoothOff');
  });

  it('returns bluetoothOff when permissions granted but adapter status is unknown', async () => {
    jest
      .spyOn(blePermissionsModule, 'requestBlePermissions')
      .mockResolvedValue('granted');
    jest
      .spyOn(getBleService(), 'getAdapterStatus')
      .mockResolvedValue('unknown');

    const status = await evaluateBlePermissionGate();

    expect(status).toBe('bluetoothOff');
  });

  it('returns ready when permissions granted and adapter is poweredOn', async () => {
    jest
      .spyOn(blePermissionsModule, 'requestBlePermissions')
      .mockResolvedValue('granted');
    jest
      .spyOn(getBleService(), 'getAdapterStatus')
      .mockResolvedValue('poweredOn');

    const status = await evaluateBlePermissionGate();

    expect(status).toBe('ready');
  });
});
