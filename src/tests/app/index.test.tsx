import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import PairingScreen from '@/app/index';
import * as blePermissionGateModule from '@/services/ble/blePermissionGate';

describe('PairingScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders Pairing content when gate status is ready', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Pairing')).toBeTruthy();
      expect(getByText('Go to Workout')).toBeTruthy();
      expect(getByText('Go to History')).toBeTruthy();
    });
  });

  it('renders permission denied message and handles retry when status is permissionDenied', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('permissionDenied');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Bluetooth Permission Required')).toBeTruthy();
    });

    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();
  });

  it('renders permission blocked message and opens settings when status is permissionBlocked', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('permissionBlocked');
    const openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(async () => {});

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Permission Permanently Denied')).toBeTruthy();
    });

    const settingsButton = getByText('Open Settings');
    fireEvent.press(settingsButton);

    expect(openSettingsSpy).toHaveBeenCalled();
  });

  it('renders bluetooth off message when status is bluetoothOff', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('bluetoothOff');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Bluetooth is Turned Off')).toBeTruthy();
    });
  });
});
