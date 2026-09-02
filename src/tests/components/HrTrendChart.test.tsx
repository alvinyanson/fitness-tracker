import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HrTrendChart } from '@/components/HrTrendChart';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type { SessionStats } from '@/interfaces/session';
import { setLocale } from '@/services/i18n/i18n';

/** The SVG children are hidden from the a11y tree, so queries must opt in. */
const hidden = { includeHiddenElements: true } as const;

/** SVG text lands in a child TSpan's `content` prop, not as queryable text. */
function tickLabel(element: { children: unknown[] }): unknown {
  const tspan = element.children[0] as { props?: { content?: unknown } };
  return tspan?.props?.content;
}

const STARTED_AT = 1_700_000_000_000;

function sample(offsetMs: number, bpm: number): HeartRateSample {
  return {
    bpm,
    sensorContact: 'contactDetected',
    timestamp: STARTED_AT + offsetMs,
  };
}

const samples: HeartRateSample[] = Array.from({ length: 61 }, (_, i) =>
  sample(i * 10_000, 120 + (i % 20)),
);

const stats: SessionStats = {
  durationMs: 600_000,
  avgHr: 130,
  maxHr: 139,
  minHr: 120,
  sampleCount: samples.length,
  rawSampleCount: samples.length,
};

function renderChart(
  props?: Partial<React.ComponentProps<typeof HrTrendChart>>,
) {
  return render(
    <HrTrendChart
      samples={samples}
      startedAt={STARTED_AT}
      stats={stats}
      {...props}
    />,
  );
}

/** Gives the plot the width `onLayout` would supply on a device. */
async function layoutPlot(
  root: Awaited<ReturnType<typeof renderChart>>,
): Promise<void> {
  await fireEvent(root.getByTestId('hr-trend-plot'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 160 } },
  });
}

describe('HrTrendChart', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders nothing when there are no samples', async () => {
    const { toJSON } = await render(
      <HrTrendChart samples={[]} startedAt={STARTED_AT} stats={stats} />,
    );

    expect(toJSON()).toBeNull();
  });

  it('renders nothing when every sample is implausible', async () => {
    const { toJSON } = await render(
      <HrTrendChart
        samples={[sample(0, 0), sample(1000, 400)]}
        startedAt={STARTED_AT}
        stats={stats}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('renders the card title and both reference legends', async () => {
    const root = await renderChart();

    expect(root.getByText('HEART RATE TREND')).toBeTruthy();
    expect(root.getByText('AVG')).toBeTruthy();
    expect(root.getByText('MAX')).toBeTruthy();
  });

  it('renders the trace, tick labels, and the accessibility sentence once measured', async () => {
    const root = await renderChart();
    await layoutPlot(root);

    expect(root.getByTestId('hr-trend-chart')).toBeTruthy();
    expect(tickLabel(root.getByTestId('hr-trend-chart-tick-0', hidden))).toBe(
      '0m',
    );
    expect(tickLabel(root.getByTestId('hr-trend-chart-tick-4', hidden))).toBe(
      '10m',
    );
    expect(
      root.getByLabelText(
        'Heart rate trend over 10 minutes, average 130 bpm, maximum 139 bpm',
      ),
    ).toBeTruthy();
  });

  it('holds the chart back until a positive width is measured', async () => {
    const root = await renderChart();

    expect(root.queryByTestId('hr-trend-chart')).toBeNull();
  });

  it('splits the trace on a two-minute gap', async () => {
    const root = await renderChart({
      samples: [
        sample(0, 120),
        sample(1000, 122),
        sample(121_000, 130),
        sample(122_000, 132),
      ],
    });
    await layoutPlot(root);

    expect(root.getByTestId('hr-trend-chart-segment-0', hidden)).toBeTruthy();
    expect(root.getByTestId('hr-trend-chart-segment-1', hidden)).toBeTruthy();
  });

  it('omits both reference lines when the stats are null', async () => {
    const root = await renderChart({
      stats: { ...stats, avgHr: null, maxHr: null, minHr: null },
    });
    await layoutPlot(root);

    expect(root.queryByText('AVG')).toBeNull();
    expect(root.queryByText('MAX')).toBeNull();
    expect(root.queryByTestId('hr-trend-chart-reference-0', hidden)).toBeNull();
    // Without an average there is nothing to read out but the title.
    expect(root.getByLabelText('HEART RATE TREND')).toBeTruthy();
  });

  it('renders only the average reference line when the max is null', async () => {
    const root = await renderChart({ stats: { ...stats, maxHr: null } });
    await layoutPlot(root);

    expect(root.getByTestId('hr-trend-chart-reference-0', hidden)).toBeTruthy();
    expect(root.queryByTestId('hr-trend-chart-reference-1', hidden)).toBeNull();
  });
});
