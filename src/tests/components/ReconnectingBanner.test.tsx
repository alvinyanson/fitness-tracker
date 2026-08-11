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

  it('renders reconnecting text when visible', async () => {
    const { getByText } = await render(<ReconnectingBanner visible={true} />);
    expect(getByText('Reconnecting…')).toBeTruthy();
  });
});
