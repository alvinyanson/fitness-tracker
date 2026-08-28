import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ResponsiveContent } from '@/components/ResponsiveContent';
import type { ResponsiveLayout } from '@/hooks/useResponsiveLayout';

let mockLayout: ResponsiveLayout;

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => mockLayout,
}));

const phoneLayout = {
  contentMaxWidth: null,
  containerPadding: 20,
} as ResponsiveLayout;

const tabletLayout = {
  contentMaxWidth: 640,
  containerPadding: 32,
} as ResponsiveLayout;

function flatten(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('ResponsiveContent', () => {
  it('renders phone content with 20px padding and no max-width clamp', async () => {
    mockLayout = phoneLayout;
    const { getByTestId } = await render(
      <ResponsiveContent style={{ flex: 1 }}>
        <Text testID="child">content</Text>
      </ResponsiveContent>,
    );

    const style = flatten(getByTestId('child').parent?.props.style);
    expect(style.paddingHorizontal).toBe(20);
    expect(style.maxWidth).toBeUndefined();
  });

  it('clamps and pads content at tablet widths', async () => {
    mockLayout = tabletLayout;
    const { getByTestId } = await render(
      <ResponsiveContent>
        <Text testID="child">content</Text>
      </ResponsiveContent>,
    );

    const style = flatten(getByTestId('child').parent?.props.style);
    expect(style.paddingHorizontal).toBe(32);
    expect(style.maxWidth).toBe(640);
    expect(style.alignSelf).toBe('center');
  });

  it('drops the clamp when fullBleed is set', async () => {
    mockLayout = tabletLayout;
    const { getByTestId } = await render(
      <ResponsiveContent fullBleed>
        <Text testID="child">content</Text>
      </ResponsiveContent>,
    );

    const style = flatten(getByTestId('child').parent?.props.style);
    expect(style.maxWidth).toBeUndefined();
    expect(style.paddingHorizontal).toBe(32);
  });
});
