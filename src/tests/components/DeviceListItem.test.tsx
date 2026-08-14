import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DeviceListItem } from '@/components/DeviceListItem';
import type { DiscoveredDevice } from '@/interfaces/ble';

describe('DeviceListItem', () => {
  const baseDevice: DiscoveredDevice = {
    id: 'AA:BB:CC:DD:EE:FF',
    name: 'Heart Rate Monitor',
    rssi: -65,
  };

  const onPress = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders device name, id, and rssi', async () => {
    const { getByText } = await render(
      <DeviceListItem device={baseDevice} disabled={false} onPress={onPress} />,
    );

    expect(getByText('Heart Rate Monitor')).toBeTruthy();
    expect(getByText('AA:BB:CC:DD:EE:FF')).toBeTruthy();
    expect(getByText('-65 dBm')).toBeTruthy();
  });

  it('renders "Unknown device" fallback when name is null', async () => {
    const device: DiscoveredDevice = { ...baseDevice, name: null };
    const { getByText } = await render(
      <DeviceListItem device={device} disabled={false} onPress={onPress} />,
    );

    expect(getByText('Unknown device')).toBeTruthy();
  });

  it('renders an em dash when rssi is null', async () => {
    const device: DiscoveredDevice = { ...baseDevice, rssi: null };
    const { getByText } = await render(
      <DeviceListItem device={device} disabled={false} onPress={onPress} />,
    );

    expect(getByText('—')).toBeTruthy();
  });

  it('fires onPress with the device id when pressed', async () => {
    const { getByText } = await render(
      <DeviceListItem device={baseDevice} disabled={false} onPress={onPress} />,
    );

    fireEvent.press(getByText('Heart Rate Monitor'));
    expect(onPress).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
  });

  it('sets proper accessibility attributes including role, label, hint, and disabled state', async () => {
    const { getByRole, rerender } = await render(
      <DeviceListItem device={baseDevice} disabled={false} onPress={onPress} />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(
      'Heart Rate Monitor, BLE Tracker, -65 dBm',
    );
    expect(button.props.accessibilityHint).toBe('Connects to this device');
    expect(button.props.accessibilityState).toEqual({ disabled: false });

    await rerender(
      <DeviceListItem device={baseDevice} disabled={true} onPress={onPress} />,
    );
    const disabledButton = getByRole('button');
    expect(disabledButton.props.accessibilityState).toEqual({ disabled: true });
  });
});
