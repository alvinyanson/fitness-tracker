import {
  ExerciseType,
  RecordingMethod,
  type ExerciseSessionRecord,
  type HeartRateRecord,
} from 'react-native-health-connect';

type HealthConnectHeartRateSample = HeartRateRecord['samples'][number];
import type { PersistedSession } from '@/interfaces/session';
import {
  MIN_PLAUSIBLE_BPM,
  MAX_PLAUSIBLE_BPM,
} from '@/services/session/sessionStats';

export const HEALTH_CONNECT_CLIENT_RECORD_PREFIX = '@fitness_tracker/session/';

export interface MappedSessionRecords {
  exercise: ExerciseSessionRecord;
  /** Omitted when no sample survives filtering. */
  heartRate?: HeartRateRecord;
  /** Samples excluded by the window / plausibility / dedupe rules. */
  droppedSampleCount: number;
}

export function mapSessionToHealthRecords(
  session: PersistedSession,
  options?: { title?: string },
): MappedSessionRecords {
  const isDegenerate = session.endedAt <= session.startedAt;
  const startTime = new Date(session.startedAt).toISOString();
  const endTime = isDegenerate
    ? new Date(session.startedAt + 1).toISOString()
    : new Date(session.endedAt).toISOString();

  const exercise: ExerciseSessionRecord = {
    recordType: 'ExerciseSession',
    exerciseType: ExerciseType.OTHER_WORKOUT,
    startTime,
    endTime,
    ...(options?.title ? { title: options.title } : {}),
    metadata: {
      clientRecordId: `${HEALTH_CONNECT_CLIENT_RECORD_PREFIX}${session.id}`,
      clientRecordVersion: 1,
      recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
    },
  };

  if (isDegenerate) {
    return {
      exercise,
      heartRate: undefined,
      droppedSampleCount: session.samples.length,
    };
  }

  const samplesByTimestamp = new Map<number, number>();

  for (const sample of session.samples) {
    const { timestamp, bpm } = sample;
    const inWindow =
      timestamp >= session.startedAt && timestamp <= session.endedAt;
    const isPlausible = bpm >= MIN_PLAUSIBLE_BPM && bpm <= MAX_PLAUSIBLE_BPM;

    if (inWindow && isPlausible) {
      samplesByTimestamp.set(timestamp, bpm);
    }
  }

  if (samplesByTimestamp.size === 0) {
    return {
      exercise,
      heartRate: undefined,
      droppedSampleCount: session.samples.length,
    };
  }

  const sortedEntries = Array.from(samplesByTimestamp.entries()).sort(
    (a, b) => a[0] - b[0],
  );

  const mappedSamples: HealthConnectHeartRateSample[] = sortedEntries.map(
    ([timestamp, bpm]) => ({
      time: new Date(timestamp).toISOString(),
      beatsPerMinute: bpm,
    }),
  );

  const heartRate: HeartRateRecord = {
    recordType: 'HeartRate',
    startTime,
    endTime,
    samples: mappedSamples,
    metadata: {
      clientRecordId: `${HEALTH_CONNECT_CLIENT_RECORD_PREFIX}${session.id}/hr`,
      clientRecordVersion: 1,
      recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
    },
  };

  return {
    exercise,
    heartRate,
    droppedSampleCount: session.samples.length - mappedSamples.length,
  };
}
