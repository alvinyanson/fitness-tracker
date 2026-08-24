import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SegmentedControl } from '@/components/SegmentedControl';

const options = [
  { value: 'metric', label: 'Metric', accessibilityHint: 'Selects metric' },
  {
    value: 'imperial',
    label: 'Imperial',
    accessibilityHint: 'Selects imperial',
  },
] as const;

describe('SegmentedControl', () => {
  it('exposes accessibility props per segment', async () => {
    const { getByRole } = await render(
      <SegmentedControl
        options={options}
        value="metric"
        onChange={() => undefined}
      />,
    );

    const metric = getByRole('button', { name: 'Metric' });
    expect(metric.props.accessibilityRole).toBe('button');
    expect(metric.props.accessibilityLabel).toBe('Metric');
    expect(metric.props.accessibilityHint).toBe('Selects metric');
    expect(metric.props.accessibilityState).toEqual({ selected: true });

    const imperial = getByRole('button', { name: 'Imperial' });
    expect(imperial.props.accessibilityHint).toBe('Selects imperial');
    expect(imperial.props.accessibilityState).toEqual({ selected: false });
  });

  it('calls onChange with the pressed option value', async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <SegmentedControl options={options} value="metric" onChange={onChange} />,
    );

    fireEvent.press(getByRole('button', { name: 'Imperial' }));
    expect(onChange).toHaveBeenCalledWith('imperial');
  });

  it('renders more than two options', async () => {
    const three = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ] as const;

    const { getByRole } = await render(
      <SegmentedControl options={three} value="b" onChange={() => undefined} />,
    );

    expect(getByRole('button', { name: 'A' }).props.accessibilityState).toEqual(
      {
        selected: false,
      },
    );
    expect(getByRole('button', { name: 'B' }).props.accessibilityState).toEqual(
      {
        selected: true,
      },
    );
    expect(getByRole('button', { name: 'C' })).toBeTruthy();
  });
});
