import type { ChartPoint, PlotArea } from '@/interfaces/chart';
import {
  buildXTicks,
  computeDomain,
  downsamplePoints,
  downsampleSegments,
  scaleX,
  scaleY,
  splitOnGaps,
  toPolylinePoints,
} from '@/services/chart/chartSeries';

const plot: PlotArea = { x: 0, y: 0, width: 100, height: 50 };

function ramp(count: number, step = 1): ChartPoint[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * step, y: 60 + i }));
}

describe('splitOnGaps', () => {
  it('returns no segments for empty input', () => {
    expect(splitOnGaps([], 1000)).toEqual([]);
  });

  it('keeps one segment when no delta exceeds the threshold', () => {
    const points = [
      { x: 0, y: 80 },
      { x: 1000, y: 82 },
      { x: 2000, y: 84 },
    ];

    expect(splitOnGaps(points, 1500)).toEqual([points]);
  });

  it('treats a delta exactly at the threshold as no gap', () => {
    const points = [
      { x: 0, y: 80 },
      { x: 1500, y: 82 },
    ];

    expect(splitOnGaps(points, 1500)).toHaveLength(1);
  });

  it('splits on a delta just over the threshold', () => {
    const points = [
      { x: 0, y: 80 },
      { x: 1501, y: 82 },
      { x: 2501, y: 84 },
    ];

    const segments = splitOnGaps(points, 1500);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([{ x: 0, y: 80 }]);
    expect(segments[1]).toHaveLength(2);
  });

  it('keeps a single point as its own segment', () => {
    expect(splitOnGaps([{ x: 0, y: 80 }], 1000)).toEqual([[{ x: 0, y: 80 }]]);
  });
});

describe('downsamplePoints', () => {
  it('returns the input unchanged when it already fits the budget', () => {
    const points = ramp(10);

    expect(downsamplePoints(points, 10)).toBe(points);
    expect(downsamplePoints(points, 50)).toBe(points);
  });

  it('returns the input unchanged for a budget below three', () => {
    const points = ramp(10);

    expect(downsamplePoints(points, 2)).toBe(points);
  });

  it('honours the budget and keeps the first and last point', () => {
    const points = ramp(1000);

    const result = downsamplePoints(points, 50);

    expect(result).toHaveLength(50);
    expect(result[0]).toEqual({ x: 0, y: 60 });
    expect(result[result.length - 1]).toEqual({ x: 999, y: 1059 });
  });

  it('retains a lone spike that a stride-based sample would drop', () => {
    const points: ChartPoint[] = Array.from({ length: 200 }, (_, i) => ({
      x: i,
      y: 80,
    }));
    // Index 77 is not a multiple of the stride a naive every-Nth sample uses.
    points[77] = { x: 77, y: 200 };

    const result = downsamplePoints(points, 20);

    expect(result.some((point) => point.y === 200)).toBe(true);
  });
});

describe('downsampleSegments', () => {
  it('returns the segments unchanged when the total fits the budget', () => {
    const segments = [ramp(5), ramp(5)];

    expect(downsampleSegments(segments, 20)).toBe(segments);
  });

  it('splits the budget across segments without exceeding it', () => {
    const segments = [ramp(2000), ramp(700)];

    const result = downsampleSegments(segments, 240);
    const total = result.reduce((sum, segment) => sum + segment.length, 0);

    expect(result).toHaveLength(2);
    expect(total).toBeLessThanOrEqual(240);
    expect(result[0]!.length).toBeGreaterThan(result[1]!.length);
  });

  it('collapses a segment to its ends when its share is below three', () => {
    const segments = [ramp(1000), ramp(4)];

    const result = downsampleSegments(segments, 10);

    expect(result[1]).toEqual([
      { x: 0, y: 60 },
      { x: 3, y: 63 },
    ]);
  });

  it('handles all-empty segments', () => {
    expect(downsampleSegments([[], []], 10)).toEqual([[], []]);
  });

  it('lets the two-point floor exceed the budget when segments outnumber it', () => {
    // A strap dropping out every 20s yields far more segments than maxPoints/2.
    const segments = Array.from({ length: 40 }, () => ramp(20));

    const result = downsampleSegments(segments, 20);
    const total = result.reduce((sum, segment) => sum + segment.length, 0);

    // Every run still gets drawn as a line rather than being dropped.
    expect(result).toHaveLength(40);
    expect(result.every((segment) => segment.length === 2)).toBe(true);
    expect(total).toBe(80);
  });
});

describe('computeDomain', () => {
  it('returns null for no segments and for all-empty segments', () => {
    expect(computeDomain([])).toBeNull();
    expect(computeDomain([[], []])).toBeNull();
  });

  it('spans every segment', () => {
    const domain = computeDomain([
      [
        { x: 0, y: 80 },
        { x: 10, y: 120 },
      ],
      [
        { x: 40, y: 60 },
        { x: 50, y: 100 },
      ],
    ]);

    expect(domain).toEqual({ minX: 0, maxX: 50, minY: 60, maxY: 120 });
  });

  it('expands a flat y range by the padding', () => {
    const domain = computeDomain([
      [
        { x: 0, y: 90 },
        { x: 10, y: 90 },
      ],
    ]);

    expect(domain).toEqual({ minX: 0, maxX: 10, minY: 85, maxY: 95 });
  });

  it('honours a custom y padding', () => {
    const domain = computeDomain(
      [
        [
          { x: 0, y: 90 },
          { x: 10, y: 90 },
        ],
      ],
      { yPadding: 20 },
    );

    expect(domain).toMatchObject({ minY: 70, maxY: 110 });
  });

  it('expands a single-x domain so scaling cannot divide by zero', () => {
    const domain = computeDomain([[{ x: 5, y: 90 }]]);

    expect(domain).toEqual({ minX: 4, maxX: 6, minY: 85, maxY: 95 });
  });
});

describe('scaleX / scaleY', () => {
  const domain = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

  it('maps the domain onto the plot rect', () => {
    expect(scaleX(50, domain, plot)).toBe(50);
    expect(scaleY(0, domain, plot)).toBe(50);
    expect(scaleY(100, domain, plot)).toBe(0);
  });

  it('respects the plot origin', () => {
    const inset: PlotArea = { x: 10, y: 5, width: 100, height: 50 };

    expect(scaleX(0, domain, inset)).toBe(10);
    expect(scaleY(100, domain, inset)).toBe(5);
  });

  it('clamps out-of-domain values to the plot rect', () => {
    expect(scaleX(-50, domain, plot)).toBe(0);
    expect(scaleX(500, domain, plot)).toBe(100);
    expect(scaleY(-50, domain, plot)).toBe(50);
    expect(scaleY(500, domain, plot)).toBe(0);
  });
});

describe('toPolylinePoints', () => {
  it('emits space-separated pixel pairs', () => {
    const domain = { minX: 0, maxX: 10, minY: 0, maxY: 100 };

    const points = toPolylinePoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 100 },
      ],
      domain,
      plot,
    );

    expect(points).toBe('0,50 100,0');
  });

  it('emits an empty string for an empty segment', () => {
    expect(
      toPolylinePoints([], { minX: 0, maxX: 1, minY: 0, maxY: 1 }, plot),
    ).toBe('');
  });
});

describe('buildXTicks', () => {
  const domain = { minX: 0, maxX: 600_000, minY: 60, maxY: 180 };

  it('returns evenly spaced, formatted ticks', () => {
    const ticks = buildXTicks(domain, 5, (value) => `${value / 60_000}m`);

    expect(ticks.map((tick) => tick.label)).toEqual([
      '0m',
      '2.5m',
      '5m',
      '7.5m',
      '10m',
    ]);
    expect(ticks[4]!.value).toBe(600_000);
  });

  it('returns nothing for fewer than two ticks', () => {
    expect(buildXTicks(domain, 1, String)).toEqual([]);
    expect(buildXTicks(domain, 0, String)).toEqual([]);
  });
});
