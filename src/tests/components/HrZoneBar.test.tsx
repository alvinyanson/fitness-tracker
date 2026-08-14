import React from 'react';
import { render } from '@testing-library/react-native';
import { HrZoneBar, getZoneIndex } from '@/components/HrZoneBar';

describe('HrZoneBar', () => {
  it('calculates correct zone index', () => {
    expect(getZoneIndex(null)).toBe(-1);
    expect(getZoneIndex(0)).toBe(-1);
    expect(getZoneIndex(110)).toBe(0);
    expect(getZoneIndex(130)).toBe(1);
    expect(getZoneIndex(150)).toBe(2);
    expect(getZoneIndex(170)).toBe(3);
    expect(getZoneIndex(190)).toBe(4);
  });

  it('renders zone label and accessibility properties when active', async () => {
    const { getByLabelText, getByText } = await render(<HrZoneBar bpm={150} />);

    expect(getByText('ZONE 3: AEROBIC')).toBeTruthy();
    const container = getByLabelText('ZONE 3: AEROBIC');
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityRole).toBe('text');
  });

  it('renders no data label when bpm is null', async () => {
    const { getByLabelText, getByText } = await render(
      <HrZoneBar bpm={null} />,
    );

    expect(getByText('ZONE --: NO DATA')).toBeTruthy();
    const container = getByLabelText('ZONE --: NO DATA');
    expect(container.props.accessible).toBe(true);
  });
});
