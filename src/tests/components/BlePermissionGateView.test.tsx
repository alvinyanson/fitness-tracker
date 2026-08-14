import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BlePermissionGateView } from '@/components/BlePermissionGateView';

describe('BlePermissionGateView', () => {
  const onRetry = jest.fn();
  const onOpenSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders checking status with disabled state', async () => {
    const { getByRole, getByText } = await render(
      <BlePermissionGateView
        status="checking"
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
      />,
    );

    const title = getByText('Checking Permissions');
    expect(title.props.accessibilityRole).toBe('header');

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button.props.accessibilityLabel).toBe('Checking...');
  });

  it('renders permissionDenied status with retry hint and handles press', async () => {
    const { getByRole } = await render(
      <BlePermissionGateView
        status="permissionDenied"
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
      />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Retry');
    expect(button.props.accessibilityHint).toBe(
      'Retries Bluetooth permission check',
    );
    expect(button.props.accessibilityState).toEqual({ disabled: false });

    fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders permissionBlocked status with openSettings hint and handles press', async () => {
    const { getByRole } = await render(
      <BlePermissionGateView
        status="permissionBlocked"
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
      />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Open Settings');
    expect(button.props.accessibilityHint).toBe(
      'Opens device settings to grant permissions',
    );

    fireEvent.press(button);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
