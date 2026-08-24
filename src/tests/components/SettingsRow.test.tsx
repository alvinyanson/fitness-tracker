import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SettingsRow } from '@/components/SettingsRow';

describe('SettingsRow', () => {
  it('renders the label and the child control', async () => {
    const { getByText } = await render(
      <SettingsRow icon="speedometer-outline" label="Measurement System">
        <Text>Metric</Text>
      </SettingsRow>,
    );

    expect(getByText('Measurement System')).toBeTruthy();
    expect(getByText('Metric')).toBeTruthy();
  });

  it('contributes no interactive node of its own', async () => {
    const { queryAllByRole } = await render(
      <SettingsRow icon="globe-outline" label="Language">
        <Text>English</Text>
      </SettingsRow>,
    );

    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
