import type { HeartRateSample } from '@/interfaces/heartRate';

export const ROLLING_AVERAGE_WINDOW_MS = 30_000;

/**
 * Average BPM across every sample whose timestamp falls within `windowMs` of `now`.
 * Returns null when no sample falls inside the window (no data yet, or the window has
 * gone stale — e.g. a long reconnect).
 */
export function getRollingAverageBpm(
  samples: HeartRateSample[],
  now: number,
  windowMs: number = ROLLING_AVERAGE_WINDOW_MS,
): number | null {
  const windowStart = now - windowMs;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (sample.timestamp >= windowStart) {
      sum += sample.bpm;
      count += 1;
    }
  }

  if (count === 0) {
    return null;
  }

  return Math.round(sum / count);
}
