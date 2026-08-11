import type { HeartRateSample } from '@/interfaces/heartRate';
import type { WorkoutSessionSnapshot } from '@/interfaces/session';
import {
  computeSessionStats,
  MIN_PLAUSIBLE_BPM,
  MAX_PLAUSIBLE_BPM,
} from '@/services/session/sessionStats';

describe('computeSessionStats', () => {
  const createSample = (bpm: number, timestamp: number): HeartRateSample => ({
    bpm,
    timestamp,
    sensorContact: 'contactDetected',
  });

  const createSession = (
    overrides?: Partial<WorkoutSessionSnapshot>,
  ): WorkoutSessionSnapshot => ({
    status: 'stopped',
    reconnecting: false,
    startedAt: 1_000_000,
    pausedAt: null,
    totalPausedMs: 0,
    stoppedElapsedMs: 600_000,
    samples: [],
    ...overrides,
  });

  it('calculates full statistics for a normal stopped session with valid samples', () => {
    const samples = [
      createSample(120, 1_000_000 + 10_000),
      createSample(140, 1_000_000 + 20_000),
      createSample(130, 1_000_000 + 30_000),
      createSample(150, 1_000_000 + 40_000),
    ];
    const session = createSession({
      samples,
      stoppedElapsedMs: 300_000,
    });

    const stats = computeSessionStats(session);

    // avg = (120 + 140 + 130 + 150) / 4 = 540 / 4 = 135
    expect(stats).toEqual({
      durationMs: 300_000,
      avgHr: 135,
      maxHr: 150,
      minHr: 120,
      sampleCount: 4,
      rawSampleCount: 4,
    });
  });

  it('returns null for HR stats when samples array is empty but still computes duration', () => {
    const session = createSession({
      stoppedElapsedMs: 180_000,
      samples: [],
    });

    const stats = computeSessionStats(session);

    expect(stats).toEqual({
      durationMs: 180_000,
      avgHr: null,
      maxHr: null,
      minHr: null,
      sampleCount: 0,
      rawSampleCount: 0,
    });
  });

  it('returns identical avgHr, maxHr, and minHr for a single valid sample', () => {
    const samples = [createSample(142, 1_000_000 + 5_000)];
    const session = createSession({ samples });

    const stats = computeSessionStats(session);

    expect(stats.avgHr).toBe(142);
    expect(stats.maxHr).toBe(142);
    expect(stats.minHr).toBe(142);
    expect(stats.sampleCount).toBe(1);
    expect(stats.rawSampleCount).toBe(1);
  });

  it('excludes paused spans from durationMs independent of sample count', () => {
    // 10 minute total duration with 2 minutes (120,000 ms) paused
    const startedAt = 1_000_000;
    const totalPausedMs = 120_000;
    const stoppedElapsedMs = 480_000; // 600,000 total elapsed - 120,000 paused
    const samples = [
      createSample(120, startedAt + 60_000),
      createSample(130, startedAt + 120_000),
    ];
    const session = createSession({
      startedAt,
      totalPausedMs,
      stoppedElapsedMs,
      samples,
    });

    const stats = computeSessionStats(session);

    expect(stats.durationMs).toBe(480_000);
    expect(stats.sampleCount).toBe(2);
  });

  it('maintains active durationMs during a disconnect gap while reflecting fewer samples', () => {
    const startedAt = 1_000_000;
    const samples = [
      createSample(120, startedAt + 10_000), // before disconnect
      // 2 minute gap with no samples due to BLE disconnect
      createSample(124, startedAt + 130_000), // after reconnect
    ];
    const session = createSession({
      startedAt,
      stoppedElapsedMs: 300_000,
      samples,
    });

    const stats = computeSessionStats(session);

    expect(stats.durationMs).toBe(300_000);
    expect(stats.sampleCount).toBe(2);
    expect(stats.rawSampleCount).toBe(2);
  });

  it('filters out garbage samples (bpm <= 0 or outside [30, 220])', () => {
    const samples = [
      createSample(0, 1_000_000 + 1000), // dropped notification garbage
      createSample(MIN_PLAUSIBLE_BPM - 1, 1_000_000 + 2000), // 29 bpm (implausible low)
      createSample(30, 1_000_000 + 3000), // 30 bpm (min plausible)
      createSample(120, 1_000_000 + 4000), // valid
      createSample(220, 1_000_000 + 5000), // 220 bpm (max plausible)
      createSample(MAX_PLAUSIBLE_BPM + 1, 1_000_000 + 6000), // 221 bpm (implausible spike)
      createSample(250, 1_000_000 + 7000), // BLE glitch spike
    ];
    const session = createSession({ samples });

    const stats = computeSessionStats(session);

    // Valid samples: 30, 120, 220
    // Sum = 370, Count = 3, Avg = 370 / 3 = 123.33 -> 123
    expect(stats.sampleCount).toBe(3);
    expect(stats.rawSampleCount).toBe(7);
    expect(stats.minHr).toBe(30);
    expect(stats.maxHr).toBe(220);
    expect(stats.avgHr).toBe(123);
  });

  it('returns null HR stats when all samples in the buffer are garbage', () => {
    const samples = [
      createSample(0, 1_000_000 + 1000),
      createSample(10, 1_000_000 + 2000),
      createSample(250, 1_000_000 + 3000),
    ];
    const session = createSession({ samples });

    const stats = computeSessionStats(session);

    expect(stats.avgHr).toBeNull();
    expect(stats.maxHr).toBeNull();
    expect(stats.minHr).toBeNull();
    expect(stats.sampleCount).toBe(0);
    expect(stats.rawSampleCount).toBe(3);
  });

  it('does not mutate the input samples array', () => {
    const samples = [
      createSample(120, 1_000_000 + 10_000),
      createSample(130, 1_000_000 + 20_000),
    ];
    const samplesCopy = [...samples];
    const session = createSession({ samples });

    computeSessionStats(session);

    expect(session.samples).toEqual(samplesCopy);
  });
});
