import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomNavBar } from '@/components/BottomNavBar';

let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: () => mockInsets,
}));

const mockNavigate = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  __esModule: true,
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  usePathname: () => mockPathname,
}));

describe('BottomNavBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
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

    await fireEvent.press(tab1!);
    expect(mockNavigate).toHaveBeenCalledWith('/workout');

    await fireEvent.press(tab2!);
    expect(mockNavigate).toHaveBeenCalledWith('/history');
  });

  // The tabs layout renders the bar with no currentRoute prop, so the selected
  // tab comes from the pathname alone.
  describe('active tab derived from pathname', () => {
    const cases: [string, number | null][] = [
      ['/', 0],
      ['/workout', 1],
      ['/history', 2],
      ['/summary/session-123', 2],
      ['/settings', null],
    ];

    it.each(cases)(
      'marks the right tab selected on %s',
      async (path, expected) => {
        mockPathname = path;
        const { getAllByRole } = await render(<BottomNavBar />);
        const selected = getAllByRole('tab').map(
          (tab) => tab.props.accessibilityState.selected,
        );
        expect(selected).toEqual([0, 1, 2].map((i) => i === expected));
      },
    );
  });
  it('pads for landscape cutout insets on both sides', async () => {
    mockInsets = { top: 24, right: 44, bottom: 16, left: 44 };

    const { getByTestId } = await render(<BottomNavBar />);

    const style = StyleSheet.flatten(getByTestId('bottom-nav-bar').props.style);
    expect(style.paddingLeft).toBe(44);
    expect(style.paddingRight).toBe(44);
    expect(style.paddingBottom).toBe(16);
  });
});
