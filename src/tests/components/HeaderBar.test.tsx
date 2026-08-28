import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { HeaderBar } from '@/components/HeaderBar';

let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: () => mockInsets,
}));

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

describe('HeaderBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
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
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
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
  it('pads for landscape cutout insets on both sides', async () => {
    mockInsets = { top: 24, right: 44, bottom: 0, left: 44 };

    const { getByTestId } = await render(<HeaderBar title="Live Workout" />);

    const style = StyleSheet.flatten(getByTestId('header-bar').props.style);
    expect(style.paddingLeft).toBe(44);
    expect(style.paddingRight).toBe(44);
    expect(style.paddingTop).toBe(24);
  });
});
