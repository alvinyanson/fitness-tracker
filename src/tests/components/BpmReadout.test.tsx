import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { BpmReadout } from '@/components/BpmReadout';
import { responsive } from '@/theme';

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

describe('BpmReadout', () => {
  it('renders no-data placeholder when bpm is null', async () => {
    const { getByText } = await render(<BpmReadout bpm={null} />);
    expect(getByText('--')).toBeTruthy();
  });

  it('renders numeric bpm when provided', async () => {
    const { getByText } = await render(<BpmReadout bpm={142} />);
    expect(getByText('142')).toBeTruthy();
  });

  it('handles re-renders with unchanged and updated bpm values cleanly', async () => {
    const { getByText, rerender } = await render(<BpmReadout bpm={120} />);
    expect(getByText('120')).toBeTruthy();

    // Re-render with same value
    await rerender(<BpmReadout bpm={120} />);
    expect(getByText('120')).toBeTruthy();

    // Re-render with new value
    await rerender(<BpmReadout bpm={135} />);
    expect(getByText('135')).toBeTruthy();
  });

  it('sets accessible label and live region properly', async () => {
    const { getByLabelText } = await render(<BpmReadout bpm={142} />);
    const textNode = getByLabelText('142 BPM');
    expect(textNode.props.accessible).toBe(true);
    expect(textNode.props.accessibilityRole).toBe('text');
    expect(textNode.props.accessibilityLiveRegion).toBe('polite');
  });
  it('defaults to the phone readout sizing', async () => {
    const { getByText } = await render(<BpmReadout bpm={142} />);

    const style = StyleSheet.flatten(getByText('142').props.style);
    expect(style.fontSize).toBe(responsive.bpmFontSize.phone);
    expect(style.lineHeight).toBe(72);
  });

  it('applies the tablet sizes when the caller passes them', async () => {
    const { getByText } = await render(
      <BpmReadout
        bpm={142}
        fontSize={responsive.bpmFontSize.tablet}
        iconSize={responsive.bpmIconSize.tablet}
      />,
    );

    const style = StyleSheet.flatten(getByText('142').props.style);
    expect(style.fontSize).toBe(88);
    expect(style.lineHeight).toBe(99);
  });
});
