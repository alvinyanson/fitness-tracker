import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { OfflineBanner } from '@/components/OfflineBanner';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    withSequence: (...args: unknown[]) => args[args.length - 1],
  };
});

describe('OfflineBanner', () => {
  it('collapses to zero height and zero opacity when not visible', async () => {
    const { getByLabelText, queryByRole, queryByText } = await render(
      <OfflineBanner visible={false} />,
    );

    // The bar stays mounted so the transition has somewhere to run.
    const bar = getByLabelText("You're offline", {
      includeHiddenElements: true,
    });
    const style = StyleSheet.flatten(bar.props.style);
    expect(style.height).toBe(0);
    expect(style.opacity).toBe(0);
    expect(style.overflow).toBe('hidden');

    // Collapsed, so it is neither announced nor visible to queries.
    expect(queryByRole('alert')).toBeNull();
    expect(queryByText("You're offline")).toBeNull();
  });

  it('expands with an assertive alert region when visible', async () => {
    const { getByRole, getByText } = await render(
      <OfflineBanner visible={true} />,
    );

    expect(getByText("You're offline")).toBeTruthy();

    const alert = getByRole('alert');
    expect(alert.props.accessible).toBe(true);
    expect(alert.props.accessibilityLabel).toBe("You're offline");
    expect(alert.props.accessibilityLiveRegion).toBe('assertive');

    const style = StyleSheet.flatten(alert.props.style);
    expect(style.height).toBeGreaterThan(0);
    expect(style.opacity).toBe(1);
  });
});
