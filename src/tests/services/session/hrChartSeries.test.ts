import type { HeartRateSample } from '@/interfaces/heartRate';
import {
  buildHrChartSegments,
  HR_CHART_MAX_POINTS,
  HR_GAP_THRESHOLD_MS,
} from '@/services/session/hrChartSeries';
import {
  MAX_PLAUSIBLE_BPM,
  MIN_PLAUSIBLE_BPM,
} from '@/services/session/sessionStats';

const STARTED_AT = 1_700_000_000_000;

function sample(offsetMs: number, bpm: number): HeartRateSample {
  return {
    bpm,
    sensorContact: 'contactDetected',
    timestamp: STARTED_AT + offsetMs,
  };
}

describe('buildHrChartSegments', () => {
  it('returns nothing for no samples', () => {
    expect(buildHrChartSegments([], STARTED_AT)).toEqual([]);
  });

  it('maps x to elapsed ms from the session start', () => {
    const segments = buildHrChartSegments(
      [sample(0, 80), sample(1000, 82), sample(2000, 84)],
      STARTED_AT,
    );

    expect(segments).toEqual([
      [
        { x: 0, y: 80 },
        { x: 1000, y: 82 },
        { x: 2000, y: 84 },
      ],
    ]);
  });

  it('drops samples outside the plausibility window used by the stats', () => {
    const segments = buildHrChartSegments(
      [
        sample(0, MIN_PLAUSIBLE_BPM - 1),
        sample(1000, MIN_PLAUSIBLE_BPM),
        sample(2000, MAX_PLAUSIBLE_BPM),
        sample(3000, MAX_PLAUSIBLE_BPM + 1),
      ],
      STARTED_AT,
    );

    expect(segments).toEqual([
      [
        { x: 1000, y: MIN_PLAUSIBLE_BPM },
        { x: 2000, y: MAX_PLAUSIBLE_BPM },
      ],
    ]);
  });

  it('drops samples timestamped before the session start', () => {
    const segments = buildHrChartSegments(
      [sample(-5000, 80), sample(0, 82)],
      STARTED_AT,
    );

    expect(segments).toEqual([[{ x: 0, y: 82 }]]);
  });

  it('returns nothing when every sample is implausible', () => {
    expect(
      buildHrChartSegments([sample(0, 0), sample(1000, 300)], STARTED_AT),
    ).toEqual([]);
  });

  it('splits a two-minute disconnect into two segments', () => {
    const samples = [
      sample(0, 80),
      sample(1000, 82),
      sample(121_000, 90),
      sample(122_000, 92),
    ];

    const segments = buildHrChartSegments(samples, STARTED_AT);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([
      { x: 0, y: 80 },
      { x: 1000, y: 82 },
    ]);
    expect(segments[1]).toEqual([
      { x: 121_000, y: 90 },
      { x: 122_000, y: 92 },
    ]);
  });

  it('does not split on a delta at the gap threshold', () => {
    const segments = buildHrChartSegments(
      [sample(0, 80), sample(HR_GAP_THRESHOLD_MS, 82)],
      STARTED_AT,
    );

    expect(segments).toHaveLength(1);
  });

  it('accepts an overridden gap threshold', () => {
    const segments = buildHrChartSegments(
      [sample(0, 80), sample(3000, 82)],
      STARTED_AT,
      { gapThresholdMs: 2000 },
    );

    expect(segments).toHaveLength(2);
  });

  it('reduces a 45-minute 1 Hz session to the point budget', () => {
    const samples = Array.from({ length: 2700 }, (_, i) =>
      sample(i * 1000, 100 + (i % 40)),
    );

    const segments = buildHrChartSegments(samples, STARTED_AT);
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);

    expect(total).toBeLessThanOrEqual(HR_CHART_MAX_POINTS);
    expect(total).toBeGreaterThan(2);
  });

  it('keeps the budget across segments when the session has gaps', () => {
    const samples = [
      ...Array.from({ length: 1500 }, (_, i) => sample(i * 1000, 120)),
      ...Array.from({ length: 1200 }, (_, i) =>
        sample(1_620_000 + i * 1000, 140),
      ),
    ];

    const segments = buildHrChartSegments(samples, STARTED_AT);
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);

    expect(segments).toHaveLength(2);
    expect(total).toBeLessThanOrEqual(HR_CHART_MAX_POINTS);
  });
});
