import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { BleConnectionSnapshot } from '@/interfaces/ble';
import type { WorkoutSessionStatus } from '@/interfaces/session';
import { bleService } from '@/services/ble/bleService';
import { subscribeToHeartRate } from '@/services/ble/heartRateMonitor';
import { getRollingAverageBpm } from '@/services/session/rollingAverageBpm';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export interface UseWorkoutSessionResult {
  status: WorkoutSessionStatus;
  reconnecting: boolean;
  elapsedMs: number;
  sampleCount: number;
  currentBpm: number | null;
  rollingAverageBpm: number | null;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export function useWorkoutSession(): UseWorkoutSessionResult {
  const status = useWorkoutSessionStore((state) => state.status);
  const reconnecting = useWorkoutSessionStore((state) => state.reconnecting);
  const sampleCount = useWorkoutSessionStore((state) => state.samples.length);
  const samples = useWorkoutSessionStore((state) => state.samples);
  const start = useWorkoutSessionStore((state) => state.start);
  const pause = useWorkoutSessionStore((state) => state.pause);
  const resume = useWorkoutSessionStore((state) => state.resume);
  const stop = useWorkoutSessionStore((state) => state.stop);
  const addSample = useWorkoutSessionStore((state) => state.addSample);
  const setReconnecting = useWorkoutSessionStore(
    (state) => state.setReconnecting,
  );
  const getElapsedMs = useWorkoutSessionStore((state) => state.getElapsedMs);

  const [, setTick] = useState(0);

  // Ticking effect while active
  useEffect(() => {
    if (status !== 'active') {
      return;
    }

    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [status]);

  // Keep awake effect while active
  useEffect(() => {
    if (status !== 'active') {
      return;
    }

    activateKeepAwakeAsync();

    return () => {
      deactivateKeepAwake();
    };
  }, [status]);

  // BLE connection subscription for reconnect detection and HR monitoring
  const subscribe = useCallback(
    (listener: (snapshot: BleConnectionSnapshot) => void) =>
      bleService.subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(() => bleService.getSnapshot(), []);
  const connection = useSyncExternalStore(subscribe, getSnapshot);

  const isConnected = connection.state === 'connected';

  // Reconnect detection effect
  useEffect(() => {
    if (status === 'active' || status === 'paused') {
      const isDisconnected = connection.state === 'disconnected';
      if (reconnecting !== isDisconnected) {
        setReconnecting(isDisconnected);
      }
    }
  }, [status, connection.state, reconnecting, setReconnecting]);

  // Heart rate sample ingestion effect while active and connected
  useEffect(() => {
    if (status !== 'active' || !isConnected) {
      return;
    }

    const unsubscribe = subscribeToHeartRate((sample) => {
      addSample(sample);
    });

    return () => {
      unsubscribe();
    };
  }, [status, isConnected, addSample]);

  const elapsedMs = getElapsedMs();
  const currentBpm =
    samples.length > 0 ? samples[samples.length - 1].bpm : null;
  const rollingAverageBpm = getRollingAverageBpm(samples, Date.now());

  return {
    status,
    reconnecting,
    elapsedMs,
    sampleCount,
    currentBpm,
    rollingAverageBpm,
    start,
    pause,
    resume,
    stop,
  };
}
