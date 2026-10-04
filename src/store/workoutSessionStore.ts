import { create } from 'zustand';
import type { WorkoutSessionSnapshot } from '@/interfaces/session';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type { RoutePoint } from '@/interfaces/location';
import { getElapsedMs } from '@/services/session/sessionElapsed';

export interface WorkoutSessionState extends WorkoutSessionSnapshot {
  /** idle/stopped -> active. No-op from active/paused. */
  start(): void;
  /** active -> paused. No-op otherwise. */
  pause(): void;
  /** paused -> active. No-op otherwise. */
  resume(): void;
  /** active/paused -> stopped. No-op otherwise. */
  stop(): void;
  /** Appends only while `active`. */
  addSample(sample: HeartRateSample): void;
  /** Appends only while `active`. */
  addRoutePoint(point: RoutePoint): void;
  /** No-op while idle/stopped. */
  setReconnecting(reconnecting: boolean): void;
  /** Forwards to `getElapsedMs(this, now)`. */
  getElapsedMs(now?: number): number;
}

const initialState: WorkoutSessionSnapshot = {
  status: 'idle',
  reconnecting: false,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  stoppedElapsedMs: null,
  samples: [],
  routePoints: [],
};

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  (set, get) => ({
    ...initialState,

    start: () => {
      const { status } = get();
      if (status === 'active' || status === 'paused') {
        return;
      }
      set({
        status: 'active',
        reconnecting: false,
        startedAt: Date.now(),
        pausedAt: null,
        totalPausedMs: 0,
        stoppedElapsedMs: null,
        samples: [],
        routePoints: [],
      });
    },

    pause: () => {
      const { status } = get();
      if (status !== 'active') {
        return;
      }
      set({
        status: 'paused',
        pausedAt: Date.now(),
      });
    },

    resume: () => {
      const { status, pausedAt, totalPausedMs } = get();
      if (status !== 'paused') {
        return;
      }
      const pauseSpan = pausedAt !== null ? Date.now() - pausedAt : 0;
      set({
        status: 'active',
        pausedAt: null,
        totalPausedMs: totalPausedMs + pauseSpan,
      });
    },

    stop: () => {
      const { status } = get();
      if (status !== 'active' && status !== 'paused') {
        return;
      }
      const now = Date.now();
      const elapsed = getElapsedMs(get(), now);
      set({
        status: 'stopped',
        stoppedElapsedMs: elapsed,
        pausedAt: null,
        reconnecting: false,
      });
    },

    addSample: (sample: HeartRateSample) => {
      const { status, samples } = get();
      if (status !== 'active') {
        return;
      }
      set({
        samples: [...samples, sample],
      });
    },

    addRoutePoint: (point: RoutePoint) => {
      const { status, routePoints } = get();
      if (status !== 'active') {
        return;
      }
      set({
        routePoints: [...routePoints, point],
      });
    },

    setReconnecting: (reconnecting: boolean) => {
      const { status, reconnecting: currentReconnecting } = get();
      if (status === 'idle' || status === 'stopped') {
        return;
      }
      if (currentReconnecting === reconnecting) {
        return;
      }
      set({ reconnecting });
    },

    getElapsedMs: (now?: number) => {
      return getElapsedMs(get(), now ?? Date.now());
    },
  }),
);
