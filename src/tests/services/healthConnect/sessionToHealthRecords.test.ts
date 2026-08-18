import {
  mapSessionToHealthRecords,
  HEALTH_CONNECT_CLIENT_RECORD_PREFIX,
} from '@/services/healthConnect/sessionToHealthRecords';
import type { PersistedSession } from '@/interfaces/session';
import { SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import {
  MIN_PLAUSIBLE_BPM,
  MAX_PLAUSIBLE_BPM,
} from '@/services/session/sessionStats';

describe('sessionToHealthRecords', () => {
  const baseSession: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1700000000000',
    startedAt: 1700000000000,
    endedAt: 1700003600000,
    stats: {
      durationMs: 3600000,
      avgHr: 140,
      maxHr: 160,
      minHr: 120,
      sampleCount: 2,
      rawSampleCount: 2,
    },
    samples: [
      {
        timestamp: 1700000000000,
        bpm: 120,
        sensorContact: 'contactDetected',
      },
      {
        timestamp: 1700003600000,
        bpm: 160,
        sensorContact: 'contactDetected',
      },
    ],
  };

  it('maps startedAt and endedAt to ISO strings on the ExerciseSession record', () => {
    const result = mapSessionToHealthRecords(baseSession);

    expect(result.exercise.recordType).toBe('ExerciseSession');
    expect(result.exercise.startTime).toBe(
      new Date(baseSession.startedAt).toISOString(),
    );
    expect(result.exercise.endTime).toBe(
      new Date(baseSession.endedAt).toISOString(),
    );
    expect(result.exercise.exerciseType).toBe(0);
    expect(result.exercise.metadata).toEqual({
      clientRecordId: `${HEALTH_CONNECT_CLIENT_RECORD_PREFIX}1700000000000`,
      clientRecordVersion: 1,
      recordingMethod: 1,
    });
  });

  it('includes title when supplied in options and omits it when not supplied', () => {
    const withTitle = mapSessionToHealthRecords(baseSession, {
      title: 'Morning Run',
    });
    expect(withTitle.exercise.title).toBe('Morning Run');

    const withoutTitle = mapSessionToHealthRecords(baseSession);
    expect(withoutTitle.exercise.title).toBeUndefined();
  });

  it('maps valid samples into HeartRate record sorted ascending by time', () => {
    const session: PersistedSession = {
      ...baseSession,
      samples: [
        {
          timestamp: 1700002000000,
          bpm: 150,
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700001000000,
          bpm: 130,
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.heartRate).toBeDefined();
    expect(result.heartRate?.recordType).toBe('HeartRate');
    expect(result.heartRate?.startTime).toBe(
      new Date(session.startedAt).toISOString(),
    );
    expect(result.heartRate?.endTime).toBe(
      new Date(session.endedAt).toISOString(),
    );
    expect(result.heartRate?.metadata).toEqual({
      clientRecordId: `${HEALTH_CONNECT_CLIENT_RECORD_PREFIX}1700000000000/hr`,
      clientRecordVersion: 1,
      recordingMethod: 1,
    });
    expect(result.heartRate?.samples).toEqual([
      {
        time: new Date(1700001000000).toISOString(),
        beatsPerMinute: 130,
      },
      {
        time: new Date(1700002000000).toISOString(),
        beatsPerMinute: 150,
      },
    ]);
    expect(result.droppedSampleCount).toBe(0);
  });

  it('drops implausible bpm samples and reflects them in droppedSampleCount', () => {
    const session: PersistedSession = {
      ...baseSession,
      samples: [
        {
          timestamp: 1700001000000,
          bpm: MIN_PLAUSIBLE_BPM - 1, // 29 -> dropped
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700002000000,
          bpm: 120, // valid
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700003000000,
          bpm: MAX_PLAUSIBLE_BPM + 1, // 221 -> dropped
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.heartRate?.samples).toHaveLength(1);
    expect(result.heartRate?.samples[0]).toEqual({
      time: new Date(1700002000000).toISOString(),
      beatsPerMinute: 120,
    });
    expect(result.droppedSampleCount).toBe(2);
  });

  it('drops samples outside [startedAt, endedAt] window and reflects in droppedSampleCount', () => {
    const session: PersistedSession = {
      ...baseSession,
      startedAt: 1700001000000,
      endedAt: 1700003000000,
      samples: [
        {
          timestamp: 1700000999999, // before startedAt -> dropped
          bpm: 120,
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700001000000, // at startedAt -> valid
          bpm: 125,
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700003000000, // at endedAt -> valid
          bpm: 135,
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700003000001, // after endedAt -> dropped
          bpm: 140,
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.heartRate?.samples).toHaveLength(2);
    expect(result.droppedSampleCount).toBe(2);
  });

  it('deduplicates samples with identical timestamps keeping the last one seen', () => {
    const session: PersistedSession = {
      ...baseSession,
      samples: [
        {
          timestamp: 1700001000000,
          bpm: 120,
          sensorContact: 'contactDetected',
        },
        {
          timestamp: 1700001000000,
          bpm: 130, // duplicate timestamp, last wins
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.heartRate?.samples).toEqual([
      {
        time: new Date(1700001000000).toISOString(),
        beatsPerMinute: 130,
      },
    ]);
    expect(result.droppedSampleCount).toBe(1);
  });

  it('omits heartRate record when zero samples survive filtering', () => {
    const session: PersistedSession = {
      ...baseSession,
      samples: [
        {
          timestamp: 1700001000000,
          bpm: 10, // implausible
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.exercise).toBeDefined();
    expect(result.heartRate).toBeUndefined();
    expect(result.droppedSampleCount).toBe(1);
  });

  it('omits heartRate record when session has zero samples', () => {
    const session: PersistedSession = {
      ...baseSession,
      samples: [],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.exercise).toBeDefined();
    expect(result.heartRate).toBeUndefined();
    expect(result.droppedSampleCount).toBe(0);
  });

  it('handles degenerate interval endedAt <= startedAt by setting endTime = startedAt + 1 ms, omitting heartRate, and dropping all samples', () => {
    const session: PersistedSession = {
      ...baseSession,
      startedAt: 1700000000000,
      endedAt: 1700000000000, // zero duration
      samples: [
        {
          timestamp: 1700000000000,
          bpm: 120,
          sensorContact: 'contactDetected',
        },
      ],
    };

    const result = mapSessionToHealthRecords(session);

    expect(result.exercise.startTime).toBe(
      new Date(1700000000000).toISOString(),
    );
    expect(result.exercise.endTime).toBe(new Date(1700000000001).toISOString());
    expect(result.heartRate).toBeUndefined();
    expect(result.droppedSampleCount).toBe(1);
  });
});
