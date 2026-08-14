import React from 'react';
import { render } from '@testing-library/react-native';
import { StatCard } from '@/components/StatCard';

describe('StatCard', () => {
  it('renders label, value, and unit with combined accessible label', async () => {
    const { getByLabelText, getByText } = await render(
      <StatCard label="AVG BPM" value={145} unit="bpm" />,
    );

    expect(getByText('AVG BPM')).toBeTruthy();
    expect(getByText('145')).toBeTruthy();
    expect(getByText('bpm')).toBeTruthy();

    const card = getByLabelText('AVG BPM: 145 bpm');
    expect(card.props.accessible).toBe(true);
    expect(card.props.accessibilityRole).toBe('text');
  });

  it('renders without unit gracefully', async () => {
    const { getByLabelText, getByText } = await render(
      <StatCard label="SAMPLES" value={3600} />,
    );

    expect(getByText('SAMPLES')).toBeTruthy();
    expect(getByText('3600')).toBeTruthy();

    const card = getByLabelText('SAMPLES: 3600');
    expect(card.props.accessible).toBe(true);
  });
});
