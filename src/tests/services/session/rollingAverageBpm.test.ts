import type { HeartRateSample } from '@/interfaces/heartRate';
import {
  getRollingAverageBpm,
  ROLLING_AVERAGE_WINDOW_MS,
} from '@/services/session/rollingAverageBpm';

describe('getRollingAverageBpm', () => {
  const createSample = (bpm: number, timestamp: number): HeartRateSample => ({
    bpm,
    timestamp,
    sensorContact: 'contactDetected',
  });

  it('returns null when samples array is empty', () => {
    expect(getRollingAverageBpm([], 100_000)).toBeNull();
  });

  it('returns null when all samples are outside the window', () => {
    const now = 100_000;
    const samples = [
      createSample(120, now - ROLLING_AVERAGE_WINDOW_MS - 5000),
      createSample(130, now - ROLLING_AVERAGE_WINDOW_MS - 1000),
    ];

    expect(getRollingAverageBpm(samples, now)).toBeNull();
  });

  it('calculates rounded average when all samples are inside the window', () => {
    const now = 100_000;
    const samples = [
      createSample(120, now - 20_000),
      createSample(125, now - 10_000),
      createSample(131, now - 1000),
    ];

    // (120 + 125 + 131) / 3 = 376 / 3 = 125.333... -> 125
    expect(getRollingAverageBpm(samples, now)).toBe(125);
  });

  it('filters out samples outside the window and calculates mean of in-window samples', () => {
    const now = 100_000;
    const samples = [
      createSample(180, now - 40_000), // out of window
      createSample(100, now - 35_000), // out of window
      createSample(140, now - 25_000), // in window
      createSample(150, now - 5_000), // in window
    ];

    // (140 + 150) / 2 = 145
    expect(getRollingAverageBpm(samples, now)).toBe(145);
  });

  it('supports custom windowMs parameter', () => {
    const now = 100_000;
    const customWindow = 10_000;
    const samples = [
      createSample(120, now - 15_000), // out of 10s window
      createSample(160, now - 5_000), // in window
    ];

    expect(getRollingAverageBpm(samples, now, customWindow)).toBe(160);
  });

  it('does not mutate the input samples array', () => {
    const now = 100_000;
    const samples = [
      createSample(120, now - 10_000),
      createSample(130, now - 5_000),
    ];
    const originalSamplesCopy = [...samples];

    getRollingAverageBpm(samples, now);

    expect(samples).toEqual(originalSamplesCopy);
  });
});
