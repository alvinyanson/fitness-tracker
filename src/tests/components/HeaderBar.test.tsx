import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HeaderBar } from '@/components/HeaderBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

describe('HeaderBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title with header accessibility role', async () => {
    const { getByText } = await render(<HeaderBar title="Device Pairing" />);

    const titleElement = getByText('Device Pairing');
    expect(titleElement).toBeTruthy();
    expect(titleElement.props.accessibilityRole).toBe('header');
  });

  it('renders profile button with accessibility label, hint, and button role', async () => {
    const onProfilePress = jest.fn();
    const { getByRole } = await render(
      <HeaderBar title="Test" onProfilePress={onProfilePress} />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Profile');
    expect(button.props.accessibilityHint).toBe('Opens settings screen');

    fireEvent.press(button);
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  it('navigates to settings by default when onProfilePress is omitted', async () => {
    const { getByRole } = await render(<HeaderBar title="Test" />);

    const button = getByRole('button');
    fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('renders device status badge with accessible description when provided', async () => {
    const { getByText } = await render(
      <HeaderBar
        title="Live Workout"
        deviceStatusBadge={{
          connected: true,
          name: 'Polar H10',
        }}
      />,
    );

    expect(getByText('POLAR H10')).toBeTruthy();
  });
});
