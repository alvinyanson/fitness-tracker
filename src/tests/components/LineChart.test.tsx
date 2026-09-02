import React from 'react';
import { render } from '@testing-library/react-native';
import { LineChart } from '@/components/LineChart';
import type { ChartSegment } from '@/interfaces/chart';

const segments: ChartSegment[] = [
  [
    { x: 0, y: 80 },
    { x: 1000, y: 100 },
  ],
  [
    { x: 120_000, y: 140 },
    { x: 121_000, y: 130 },
  ],
];

/** The SVG children are hidden from the a11y tree, so queries must opt in. */
const hidden = { includeHiddenElements: true } as const;

/** SVG text lands in a child TSpan's `content` prop, not as queryable text. */
function tickLabel(element: { children: unknown[] }): unknown {
  const tspan = element.children[0] as { props?: { content?: unknown } };
  return tspan?.props?.content;
}

describe('LineChart', () => {
  it('renders one polyline per segment, so a gap stays a gap', async () => {
    const { getByTestId, queryByTestId } = await render(
      <LineChart
        segments={segments}
        width={300}
        height={160}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );

    expect(getByTestId('chart-segment-0', hidden)).toBeTruthy();
    expect(getByTestId('chart-segment-1', hidden)).toBeTruthy();
    expect(queryByTestId('chart-segment-2', hidden)).toBeNull();
  });

  it('draws a dot for a single-point segment', async () => {
    const { getByTestId, queryByTestId } = await render(
      <LineChart
        segments={[[{ x: 0, y: 80 }]]}
        width={300}
        height={160}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );

    expect(getByTestId('chart-point-0', hidden)).toBeTruthy();
    expect(queryByTestId('chart-segment-0', hidden)).toBeNull();
  });

  it('renders the reference lines, dashing the ones configured for it', async () => {
    const { getByTestId } = await render(
      <LineChart
        segments={segments}
        width={300}
        height={160}
        referenceLines={[
          { value: 100, color: '#111', label: 'AVG' },
          { value: 140, color: '#222', label: 'MAX', dashed: true },
        ]}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );

    expect(
      getByTestId('chart-reference-0', hidden).props.strokeDasharray,
    ).toBeUndefined();
    expect(
      getByTestId('chart-reference-1', hidden).props.strokeDasharray,
    ).toEqual(['4', '4']);
  });

  it('renders a label per x tick', async () => {
    const { getByTestId } = await render(
      <LineChart
        segments={segments}
        width={300}
        height={160}
        xTicks={[
          { value: 0, label: '0m' },
          { value: 121_000, label: '2m' },
        ]}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );

    expect(tickLabel(getByTestId('chart-tick-0', hidden))).toBe('0m');
    expect(tickLabel(getByTestId('chart-tick-1', hidden))).toBe('2m');
  });

  it('is one accessibility element with the given role and label', async () => {
    const { getByLabelText } = await render(
      <LineChart
        segments={segments}
        width={300}
        height={160}
        accessibilityLabel="Heart rate trend"
        testID="chart"
      />,
    );

    const container = getByLabelText('Heart rate trend');
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityRole).toBe('image');
  });

  it('renders nothing without segments or without a measured width', async () => {
    const empty = await render(
      <LineChart
        segments={[]}
        width={300}
        height={160}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );
    expect(empty.toJSON()).toBeNull();

    const unmeasured = await render(
      <LineChart
        segments={segments}
        width={0}
        height={160}
        accessibilityLabel="Trend"
        testID="chart"
      />,
    );
    expect(unmeasured.toJSON()).toBeNull();
  });
});
