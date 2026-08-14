import React from 'react';
import { render } from '@testing-library/react-native';
import { ReconnectingBanner } from '@/components/ReconnectingBanner';

describe('ReconnectingBanner', () => {
  it('renders null when not visible', async () => {
    const { queryByText } = await render(
      <ReconnectingBanner visible={false} />,
    );
    expect(queryByText('Reconnecting…')).toBeNull();
  });

  it('renders reconnecting text when visible with accessibility alert role', async () => {
    const { getByRole, getByText } = await render(
      <ReconnectingBanner visible={true} />,
    );
    expect(getByText('Reconnecting…')).toBeTruthy();
    const alert = getByRole('alert');
    expect(alert.props.accessible).toBe(true);
    expect(alert.props.accessibilityLabel).toBe('Reconnecting…');
    expect(alert.props.accessibilityLiveRegion).toBe('assertive');
  });
});
