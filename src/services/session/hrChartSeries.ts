import type { ChartPoint, ChartSegment } from '@/interfaces/chart';
import type { HeartRateSample } from '@/interfaces/heartRate';
import { downsampleSegments, splitOnGaps } from '@/services/chart/chartSeries';
import { MAX_PLAUSIBLE_BPM, MIN_PLAUSIBLE_BPM } from './sessionStats';

/** HR notifications land ~1/s; this much silence is a disconnect or a pause, not jitter. */
export const HR_GAP_THRESHOLD_MS = 15_000;
/** Point budget for one rendered trace. */
export const HR_CHART_MAX_POINTS = 240;

/** Samples → gap-split, downsampled segments in elapsed-ms / bpm units. */
export function buildHrChartSegments(
  samples: HeartRateSample[],
  startedAt: number,
  options?: { gapThresholdMs?: number; maxPoints?: number },
): ChartSegment[] {
  const gapThresholdMs = options?.gapThresholdMs ?? HR_GAP_THRESHOLD_MS;
  const maxPoints = options?.maxPoints ?? HR_CHART_MAX_POINTS;

  const points: ChartPoint[] = [];
  for (const sample of samples) {
    // Same plausibility window as `computeSessionStats`, so the trace and the
    // stat cards can never disagree.
    if (sample.bpm < MIN_PLAUSIBLE_BPM || sample.bpm > MAX_PLAUSIBLE_BPM) {
      continue;
    }
    const x = sample.timestamp - startedAt;
    if (x < 0) {
      continue;
    }
    points.push({ x, y: sample.bpm });
  }

  if (points.length === 0) {
    return [];
  }

  // Split before downsampling: LTTB across a gap would place a bucket spanning
  // it and emit exactly the interpolated straight line the gap must not show.
  return downsampleSegments(splitOnGaps(points, gapThresholdMs), maxPoints);
}
