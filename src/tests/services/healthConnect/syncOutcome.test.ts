import {
  failedOutcome,
  MAX_SYNC_ATTEMPTS,
  syncedOutcome,
} from '@/services/healthConnect/syncOutcome';

describe('syncOutcome', () => {
  const mockNow = 1700005000000;

  describe('MAX_SYNC_ATTEMPTS', () => {
    it('is configured to 5', () => {
      expect(MAX_SYNC_ATTEMPTS).toBe(5);
    });
  });

  describe('syncedOutcome', () => {
    it('returns a synced sync record with matching timestamp and exerciseRecordId', () => {
      const result = syncedOutcome(mockNow, 'exercise-rec-123');

      expect(result).toEqual({
        state: 'synced',
        attemptedAt: mockNow,
        syncedAt: mockNow,
        exerciseRecordId: 'exercise-rec-123',
      });
    });
  });

  describe('failedOutcome', () => {
    it('increments failedAttempts on write-failed and produces state: failed when under threshold', () => {
      const result = failedOutcome(mockNow, 'write-failed', 0);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        failedAttempts: 1,
        reason: 'write-failed',
      });
    });

    it('increments from existing failedAttempts on write-failed', () => {
      const result = failedOutcome(mockNow, 'write-failed', 2);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        failedAttempts: 3,
        reason: 'write-failed',
      });
    });

    it('sets state: abandoned when write-failed attempts reach MAX_SYNC_ATTEMPTS', () => {
      const result = failedOutcome(mockNow, 'write-failed', 4);

      expect(result).toEqual({
        state: 'abandoned',
        attemptedAt: mockNow,
        failedAttempts: 5,
        reason: 'write-failed',
      });
    });

    it('sets state: abandoned when write-failed attempts exceed MAX_SYNC_ATTEMPTS', () => {
      const result = failedOutcome(mockNow, 'write-failed', 5);

      expect(result).toEqual({
        state: 'abandoned',
        attemptedAt: mockNow,
        failedAttempts: 6,
        reason: 'write-failed',
      });
    });

    it('preserves existing failedAttempts on unavailable without incrementing', () => {
      const result = failedOutcome(mockNow, 'unavailable', 3);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        failedAttempts: 3,
        reason: 'unavailable',
      });
    });

    it('omits failedAttempts if count is 0 on unavailable', () => {
      const result = failedOutcome(mockNow, 'unavailable', 0);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        reason: 'unavailable',
      });
    });

    it('preserves existing failedAttempts on permission-denied without incrementing', () => {
      const result = failedOutcome(mockNow, 'permission-denied', 2);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        failedAttempts: 2,
        reason: 'permission-denied',
      });
    });

    it('omits failedAttempts if count is 0 on permission-denied', () => {
      const result = failedOutcome(mockNow, 'permission-denied', 0);

      expect(result).toEqual({
        state: 'failed',
        attemptedAt: mockNow,
        reason: 'permission-denied',
      });
    });
  });
});
