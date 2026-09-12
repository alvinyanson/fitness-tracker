import type { HeartRateSample } from '@/interfaces/heartRate';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import {
  getHrSampleCount,
  getHrSamples,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';
import { resetDatabaseForTests } from '@/services/storage/sqliteDatabase';

describe('hrSampleQueries', () => {
  const sessionId = 'session-test-3600';
  const startedAt = 1700000000000;
  const sampleCount = 3600;

  beforeEach(() => {
    resetDatabaseForTests();

    // Create a 1-hour session fixture with 3,600 samples (1 per second)
    const samples: HeartRateSample[] = Array.from(
      { length: sampleCount },
      (_, i) => ({
        timestamp: startedAt + i * 1000,
        bpm: 100 + (i % 50),
        sensorContact: 'contactDetected',
        energyExpended: i * 0.1,
        rrIntervals: [800 + (i % 50)],
      }),
    );

    const session: PersistedSession = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: sessionId,
      startedAt,
      endedAt: startedAt + (sampleCount - 1) * 1000,
      stats: {
        durationMs: (sampleCount - 1) * 1000,
        avgHr: 125,
        maxHr: 150,
        minHr: 100,
        sampleCount,
        rawSampleCount: sampleCount,
      },
      samples,
    };

    saveSession(session);
  });

  afterEach(() => {
    resetDatabaseForTests();
  });

  describe('getHrSampleCount', () => {
    it('returns exact count of stored samples for the session', () => {
      expect(getHrSampleCount(sessionId)).toBe(3600);
    });

    it('returns 0 for an unknown session id', () => {
      expect(getHrSampleCount('unknown-session')).toBe(0);
    });
  });

  describe('getHrSamples without limit', () => {
    it('returns all samples ordered by seq when no limit is provided', () => {
      const results = getHrSamples(sessionId);
      expect(results).toHaveLength(3600);
      expect(results[0]?.timestamp).toBe(startedAt);
      expect(results[3599]?.timestamp).toBe(startedAt + 3599 * 1000);
      expect(results[0]?.bpm).toBe(100);
      expect(results[0]?.rrIntervals).toEqual([800]);
      expect(results[0]?.energyExpended).toBe(0);
    });
  });

  describe('getHrSamples with stride downsampling (limit)', () => {
    it('returns at most limit rows for limit: 480, spans the full range, and includes the final sample', () => {
      const limit = 480;
      const results = getHrSamples(sessionId, { limit });

      expect(results.length).toBeLessThanOrEqual(limit);
      expect(results.length).toBeGreaterThan(0);

      // Spans full range
      expect(results[0]?.timestamp).toBe(startedAt);
      const lastExpectedTimestamp = startedAt + (sampleCount - 1) * 1000;
      expect(results[results.length - 1]?.timestamp).toBe(
        lastExpectedTimestamp,
      );

      // Verify ascending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.timestamp).toBeGreaterThan(
          results[i - 1]!.timestamp,
        );
      }
    });

    it('returns at most limit rows for limit: 100, spans full range, and includes the final sample', () => {
      const limit = 100;
      const results = getHrSamples(sessionId, { limit });

      expect(results.length).toBeLessThanOrEqual(limit);
      expect(results[0]?.timestamp).toBe(startedAt);
      const lastExpectedTimestamp = startedAt + (sampleCount - 1) * 1000;
      expect(results[results.length - 1]?.timestamp).toBe(
        lastExpectedTimestamp,
      );
    });

    it('returns all samples when limit exceeds the sample count', () => {
      const results = getHrSamples(sessionId, { limit: 5000 });
      expect(results).toHaveLength(3600);
    });
  });

  describe('getHrSamples range bounds (fromMs, toMs)', () => {
    it('honors fromMs and toMs bounds without limit', () => {
      const fromMs = startedAt + 100_000;
      const toMs = startedAt + 200_000;

      const results = getHrSamples(sessionId, { fromMs, toMs });
      expect(results.length).toBe(101); // 100s to 200s inclusive = 101 samples
      expect(results[0]?.timestamp).toBe(fromMs);
      expect(results[results.length - 1]?.timestamp).toBe(toMs);
    });

    it('honors range bounds together with limit downsampling and includes the final sample of the window', () => {
      const fromMs = startedAt + 100_000;
      const toMs = startedAt + 1_000_000;
      const limit = 50;

      const results = getHrSamples(sessionId, { fromMs, toMs, limit });
      expect(results.length).toBeLessThanOrEqual(limit);
      expect(results[0]?.timestamp).toBe(fromMs);
      expect(results[results.length - 1]?.timestamp).toBe(toMs);
    });

    it('returns empty array when bounds match no samples', () => {
      const results = getHrSamples(sessionId, {
        fromMs: startedAt + 10_000_000,
        toMs: startedAt + 11_000_000,
      });
      expect(results).toEqual([]);
    });
  });
});
