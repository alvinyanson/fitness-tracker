import type { HeartRateSample } from './heartRate';

/** Explicit union per CLAUDE.md's domain convention. */
export type WorkoutSessionStatus = 'idle' | 'active' | 'paused' | 'stopped';

/** The one payload `useWorkoutSessionStore` holds, minus its actions. */
export interface WorkoutSessionSnapshot {
  status: WorkoutSessionStatus;
  /** BLE drop in progress. */
  reconnecting: boolean;
  /** Set by `start()`. */
  startedAt: number | null;
  /** Set while `status === 'paused'`. */
  pausedAt: number | null;
  /** Sum of completed pause spans, ms. */
  totalPausedMs: number;
  /** Elapsed ms frozen at `stop()`. */
  stoppedElapsedMs: number | null;
  /** Appended only while `active`. */
  samples: HeartRateSample[];
}

/** Pure reduction of a session's timing + HR samples. */
export interface SessionStats {
  /** Elapsed active ms, excluding paused spans. */
  durationMs: number;
  /** Rounded mean bpm; null if no valid samples. */
  avgHr: number | null;
  /** Highest valid bpm; null if none. */
  maxHr: number | null;
  /** Lowest valid bpm; null if none. */
  minHr: number | null;
  /** Samples that passed the plausibility filter. */
  sampleCount: number;
  /** Buffer length before filtering. */
  rawSampleCount: number;
}
