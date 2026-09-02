import type {
  ChartDomain,
  ChartPoint,
  ChartSegment,
  ChartTick,
  PlotArea,
} from '@/interfaces/chart';

/** Expansion applied to a degenerate axis (min === max) so nothing divides by zero. */
const DEFAULT_Y_PADDING = 5;
const X_PADDING = 1;
/** Below this a segment is drawn from its endpoints alone. */
const MIN_LTTB_POINTS = 3;

/** Splits where consecutive x values are further apart than `gapThreshold`. */
export function splitOnGaps(
  points: ChartPoint[],
  gapThreshold: number,
): ChartSegment[] {
  if (points.length === 0) {
    return [];
  }

  const segments: ChartSegment[] = [];
  let current: ChartPoint[] = [];

  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous !== undefined && point.x - previous.x > gapThreshold) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }

  segments.push(current);
  return segments;
}

/** Mean of `points[from…to)`, or `fallback` when that range is empty. */
function meanOf(
  points: ChartPoint[],
  from: number,
  to: number,
  fallback: ChartPoint,
): ChartPoint {
  let x = 0;
  let y = 0;
  let count = 0;

  for (let i = from; i < to; i += 1) {
    const point = points[i];
    if (point) {
      x += point.x;
      y += point.y;
      count += 1;
    }
  }

  return count === 0 ? fallback : { x: x / count, y: y / count };
}

/** Index in `points[from…to)` forming the widest triangle with `anchor` and `next`. */
function widestTriangleIndex(
  points: ChartPoint[],
  from: number,
  to: number,
  anchor: ChartPoint,
  next: ChartPoint,
): number {
  let bestArea = -1;
  let bestIndex = from;

  for (let i = from; i < to; i += 1) {
    const point = points[i];
    if (!point) {
      continue;
    }
    // Twice the true area — the ×½ is dropped because only the ranking matters.
    const area = Math.abs(
      (anchor.x - next.x) * (point.y - anchor.y) -
        (anchor.x - point.x) * (next.y - anchor.y),
    );
    if (area > bestArea) {
      bestArea = area;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/** Largest-Triangle-Three-Buckets: keeps peaks a naive stride would drop. */
export function downsamplePoints(
  points: ChartPoint[],
  maxPoints: number,
): ChartPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (
    maxPoints < MIN_LTTB_POINTS ||
    points.length <= maxPoints ||
    !first ||
    !last
  ) {
    return points;
  }

  // One point per bucket; the first and last are always kept outside them.
  const bucketSize = (points.length - 2) / (maxPoints - 2);
  const bucketStart = (bucket: number) =>
    Math.min(Math.floor(bucket * bucketSize) + 1, points.length - 1);

  const sampled: ChartPoint[] = [first];
  let anchor = first;

  for (let bucket = 0; bucket < maxPoints - 2; bucket += 1) {
    const from = bucketStart(bucket);
    const to = bucketStart(bucket + 1);
    // The next bucket's mean stands in for where the line is heading.
    const next = meanOf(points, to, bucketStart(bucket + 2), last);
    const chosen = points[widestTriangleIndex(points, from, to, anchor, next)];
    if (chosen) {
      sampled.push(chosen);
      anchor = chosen;
    }
  }

  sampled.push(last);
  return sampled;
}

/** Reduces one segment to `budget` points, always keeping its endpoints. */
function limitSegment(segment: ChartSegment, budget: number): ChartSegment {
  if (segment.length <= budget) {
    return segment;
  }
  // LTTB needs three points to have a middle bucket to choose from; below that
  // the endpoints are the whole segment.
  if (budget < MIN_LTTB_POINTS) {
    const first = segment[0];
    const last = segment[segment.length - 1];
    return first && last ? [first, last] : segment;
  }
  return downsamplePoints(segment, budget);
}

/**
 * LTTB per segment, budget split proportionally to segment length (min 2 each).
 *
 * The two-point floor wins over `maxPoints`: a series broken into more than
 * `maxPoints / 2` segments returns two points per segment and so exceeds the
 * budget. Drawing each surviving run is worth more than the cap, and at that
 * segment count the point total is still trivial to render.
 */
export function downsampleSegments(
  segments: ChartSegment[],
  maxPoints: number,
): ChartSegment[] {
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total === 0 || total <= maxPoints) {
    return segments;
  }

  // Two points per segment are reserved up front so no segment collapses to a
  // dot; the rest of the budget is shared by length. Flooring keeps the sum
  // under `maxPoints` rather than rounding past it.
  const shared = Math.max(0, maxPoints - segments.length * 2);

  return segments.map((segment) =>
    limitSegment(segment, 2 + Math.floor((segment.length / total) * shared)),
  );
}

/** Bounds across every segment; null when there is nothing to plot. */
export function computeDomain(
  segments: ChartSegment[],
  options?: { yPadding?: number },
): ChartDomain | null {
  const yPadding = options?.yPadding ?? DEFAULT_Y_PADDING;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const segment of segments) {
    for (const point of segment) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (minX === Number.POSITIVE_INFINITY) {
    return null;
  }

  // A degenerate axis would divide by zero in the scales, and a flat trace
  // would sit exactly on the frame edge.
  if (minY === maxY) {
    minY -= yPadding;
    maxY += yPadding;
  }
  if (minX === maxX) {
    minX -= X_PADDING;
    maxX += X_PADDING;
  }

  return { minX, maxX, minY, maxY };
}

/** Domain value → its 0…1 position across `[min, max]`, clamped to the ends. */
function normalize(value: number, min: number, max: number): number {
  const span = max - min;
  return span === 0 ? 0 : clamp((value - min) / span, 0, 1);
}

/** Domain value → pixel, horizontal. */
export function scaleX(
  value: number,
  domain: ChartDomain,
  plot: PlotArea,
): number {
  return plot.x + normalize(value, domain.minX, domain.maxX) * plot.width;
}

/** Domain value → pixel, for a vertical axis that grows upward. */
export function scaleY(
  value: number,
  domain: ChartDomain,
  plot: PlotArea,
): number {
  // Pixels grow downward, so the normalized value is measured up from the base.
  const ratio = normalize(value, domain.minY, domain.maxY);
  return plot.y + plot.height - ratio * plot.height;
}

/** `"x,y x,y …"` for one `<Polyline points>`. */
export function toPolylinePoints(
  segment: ChartSegment,
  domain: ChartDomain,
  plot: PlotArea,
): string {
  return segment
    .map(
      (point) =>
        `${round(scaleX(point.x, domain, plot))},${round(scaleY(point.y, domain, plot))}`,
    )
    .join(' ');
}

/** `count` evenly spaced x positions across the domain, formatted by the caller. */
export function buildXTicks(
  domain: ChartDomain,
  count: number,
  format: (value: number) => string,
): ChartTick[] {
  if (count < 2) {
    return [];
  }

  const step = (domain.maxX - domain.minX) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const value = domain.minX + i * step;
    return { value, label: format(value) };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sub-pixel precision is invisible and doubles the points string length. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
