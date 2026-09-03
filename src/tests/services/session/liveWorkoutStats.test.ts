import type { HeartRateSample } from '@/interfaces/heartRate';
import {
  ASSUMED_BODY_WEIGHT_KG,
  computeLiveWorkoutStats,
} from '@/services/session/liveWorkoutStats';

describe('computeLiveWorkoutStats', () => {
  const createSample = (bpm: number, timestamp = 0): HeartRateSample => ({
    bpm,
    timestamp,
    sensorContact: 'contactDetected',
  });

  it('returns null HR and zero calories with no samples', () => {
    expect(computeLiveWorkoutStats([], 600)).toEqual({
      avgBpm: null,
      maxBpm: null,
      calories: 0,
    });
  });

  it('averages and maxes across all samples', () => {
    const stats = computeLiveWorkoutStats(
      [createSample(100), createSample(140), createSample(121)],
      0,
    );

    expect(stats.avgBpm).toBe(120);
    expect(stats.maxBpm).toBe(140);
  });

  it('applies no plausibility filter, unlike computeSessionStats', () => {
    const stats = computeLiveWorkoutStats(
      [createSample(0), createSample(400)],
      0,
    );

    expect(stats.avgBpm).toBe(200);
    expect(stats.maxBpm).toBe(400);
  });

  it('reports zero calories before any time has elapsed', () => {
    expect(computeLiveWorkoutStats([createSample(120)], 0).calories).toBe(0);
  });

  it('uses the HR-adjusted formula when the average is above zero', () => {
    const minutes = 10;
    const calPerMin =
      (120 * 0.2017 + ASSUMED_BODY_WEIGHT_KG * 0.1988 - 55.0969) / 4.184;
    const expected = Math.round(minutes * Math.max(0.5, calPerMin));

    expect(
      computeLiveWorkoutStats([createSample(120)], minutes * 60).calories,
    ).toBe(expected);
  });

  it('floors the HR-adjusted rate at 0.5 kcal/min for a low average', () => {
    expect(computeLiveWorkoutStats([createSample(1)], 600).calories).toBe(5);
  });

  it('falls back to the MET formula when the average rounds to zero', () => {
    const stats = computeLiveWorkoutStats([createSample(0)], 3600);

    expect(stats.calories).toBe(Math.round(6.0 * ASSUMED_BODY_WEIGHT_KG));
  });
});
