import type { HeartRateSample } from '@/interfaces/heartRate';

/** Placeholder until M2 reads real body weight from Health Connect. */
export const ASSUMED_BODY_WEIGHT_KG = 70;

export interface LiveWorkoutStats {
  avgBpm: number | null;
  maxBpm: number | null;
  calories: number;
}

/** Live workout figures. No plausibility filter, unlike `computeSessionStats`. */
export function computeLiveWorkoutStats(
  samples: HeartRateSample[],
  elapsedSeconds: number,
): LiveWorkoutStats {
  if (samples.length === 0) {
    return { avgBpm: null, maxBpm: null, calories: 0 };
  }

  const sum = samples.reduce((acc, s) => acc + s.bpm, 0);
  const avg = Math.round(sum / samples.length);
  const max = Math.max(...samples.map((s) => s.bpm));

  const minutes = elapsedSeconds / 60;
  let calories = 0;
  if (minutes > 0) {
    if (avg > 0) {
      // HR-adjusted estimation formula
      const calPerMin =
        (avg * 0.2017 + ASSUMED_BODY_WEIGHT_KG * 0.1988 - 55.0969) / 4.184;
      calories = Math.max(0, Math.round(minutes * Math.max(0.5, calPerMin)));
    } else {
      // Pure MET estimation formula (MET = 6.0)
      calories = Math.round(6.0 * ASSUMED_BODY_WEIGHT_KG * (minutes / 60));
    }
  }

  return { avgBpm: avg, maxBpm: max, calories };
}
