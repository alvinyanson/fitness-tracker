import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomNavBar } from '@/components/BottomNavBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  usePathname: () => '/',
}));

describe('BottomNavBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all three tabs with accessibility roles, hints, and selected states', async () => {
    const { getAllByRole } = await render(
      <BottomNavBar currentRoute="pairing" />,
    );

    const tabs = getAllByRole('tab');
    expect(tabs.length).toBe(3);

    const tab0 = tabs[0];
    const tab1 = tabs[1];
    const tab2 = tabs[2];
    expect(tab0).toBeDefined();
    expect(tab1).toBeDefined();
    expect(tab2).toBeDefined();

    // Pairing tab
    expect(tab0!.props.accessibilityRole).toBe('tab');
    expect(tab0!.props.accessibilityLabel).toBe('Pairing');
    expect(tab0!.props.accessibilityHint).toBe(
      'Navigates to device pairing screen',
    );
    expect(tab0!.props.accessibilityState).toEqual({ selected: true });

    // Workout tab
    expect(tab1!.props.accessibilityRole).toBe('tab');
    expect(tab1!.props.accessibilityLabel).toBe('Workout');
    expect(tab1!.props.accessibilityHint).toBe(
      'Navigates to live workout screen',
    );
    expect(tab1!.props.accessibilityState).toEqual({ selected: false });

    // History tab
    expect(tab2!.props.accessibilityRole).toBe('tab');
    expect(tab2!.props.accessibilityLabel).toBe('History');
    expect(tab2!.props.accessibilityHint).toBe(
      'Navigates to workout history screen',
    );
    expect(tab2!.props.accessibilityState).toEqual({ selected: false });
  });

  it('navigates to appropriate route when tab is pressed', async () => {
    const { getAllByRole } = await render(
      <BottomNavBar currentRoute="pairing" />,
    );

    const tabs = getAllByRole('tab');
    const tab1 = tabs[1];
    const tab2 = tabs[2];
    expect(tab1).toBeDefined();
    expect(tab2).toBeDefined();

    fireEvent.press(tab1!);
    expect(mockPush).toHaveBeenCalledWith('/workout');

    fireEvent.press(tab2!);
    expect(mockPush).toHaveBeenCalledWith('/history');
  });
});
