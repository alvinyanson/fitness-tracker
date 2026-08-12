import type {
  WorkoutSessionSnapshot,
  SessionStats,
} from '@/interfaces/session';
import { getElapsedMs } from './sessionElapsed';

/** Below this, a sample is a dropped/garbage notification. */
export const MIN_PLAUSIBLE_BPM = 30;
/** Above this, a sample is a BLE-glitch spike. */
export const MAX_PLAUSIBLE_BPM = 220;

/** Reduces a session's samples + timing into duration/avg/max/min HR. */
export function computeSessionStats(
  session: WorkoutSessionSnapshot,
  now: number = Date.now(),
): SessionStats {
  const durationMs = getElapsedMs(session, now);
  const rawSampleCount = session.samples.length;

  let sum = 0;
  let sampleCount = 0;
  let maxHr: number | null = null;
  let minHr: number | null = null;

  for (const sample of session.samples) {
    const { bpm } = sample;
    if (bpm >= MIN_PLAUSIBLE_BPM && bpm <= MAX_PLAUSIBLE_BPM) {
      sum += bpm;
      sampleCount += 1;
      if (maxHr === null || bpm > maxHr) {
        maxHr = bpm;
      }
      if (minHr === null || bpm < minHr) {
        minHr = bpm;
      }
    }
  }

  const avgHr = sampleCount > 0 ? Math.round(sum / sampleCount) : null;

  return {
    durationMs,
    avgHr,
    maxHr,
    minHr,
    sampleCount,
    rawSampleCount,
  };
}
