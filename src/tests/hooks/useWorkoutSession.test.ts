import { act, renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { BleManager } from 'react-native-ble-plx';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { bleService } from '@/services/ble/bleService';
import { HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID } from '@/services/ble/gattProfiles';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(true),
  deactivateKeepAwake: jest.fn().mockResolvedValue(true),
}));

describe('useWorkoutSession', () => {
  let managerInstance: BleManager;

  const resetStore = () => {
    useWorkoutSessionStore.setState({
      status: 'idle',
      reconnecting: false,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      stoppedElapsedMs: null,
      samples: [],
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    bleService.destroy();
    managerInstance = (bleService as any).manager;
  });

  afterEach(() => {
    bleService.destroy();
    resetStore();
  });

  describe('keep-awake behavior', () => {
    it('activates keep-awake on active entry and deactivates on stop or unmount', async () => {
      const { result, unmount } = await renderHook(() => useWorkoutSession());

      expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
      expect(deactivateKeepAwake).not.toHaveBeenCalled();

      // Start session -> active
      await act(async () => {
        result.current.start();
      });

      expect(result.current.status).toBe('active');
      expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
      expect(deactivateKeepAwake).not.toHaveBeenCalled();

      // Stop session -> stopped
      await act(async () => {
        result.current.stop();
      });

      expect(result.current.status).toBe('stopped');
      expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);

      // Unmount while stopped should not call deactivateKeepAwake again
      await act(async () => {
        await unmount();
      });

      expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
    });

    it('deactivates keep-awake when unmounted while active', async () => {
      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
      expect(deactivateKeepAwake).not.toHaveBeenCalled();

      await act(async () => {
        await unmount();
      });

      expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnect flag wiring', () => {
    it('sets reconnecting true on BLE disconnect during active session, clears on reconnect', async () => {
      // Connect BLE device first
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await bleService.connect('dev-1');
      });

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      expect(result.current.status).toBe('active');
      expect(result.current.reconnecting).toBe(false);

      // Disconnect device
      await act(async () => {
        await bleService.disconnect();
      });

      expect(result.current.status).toBe('active');
      expect(result.current.reconnecting).toBe(true);

      // Reconnect device
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await bleService.connect('dev-1');
      });

      expect(result.current.status).toBe('active');
      expect(result.current.reconnecting).toBe(false);

      await act(async () => {
        await unmount();
      });
    });
  });

  describe('sample ingestion gating', () => {
    it('ingests samples only while active, gating during pause', async () => {
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await bleService.connect('dev-1');
      });

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      // Start session
      await act(async () => {
        result.current.start();
      });

      expect(result.current.sampleCount).toBe(0);

      // Emit sample while active
      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFA=', // 80 bpm
        );
      });

      expect(result.current.sampleCount).toBe(1);

      // Pause session
      await act(async () => {
        result.current.pause();
      });

      // Emit sample while paused (should be ignored)
      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFE=', // 84 bpm
        );
      });

      expect(result.current.sampleCount).toBe(1);

      // Resume session
      await act(async () => {
        result.current.resume();
      });

      // Emit sample while resumed active
      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFE=', // 84 bpm
        );
      });

      expect(result.current.sampleCount).toBe(2);

      await act(async () => {
        await unmount();
      });
    });
  });

  describe('timer ticking', () => {
    it('advances elapsedMs on interval ticks while active, freezes while paused', async () => {
      jest.useFakeTimers();
      const startTime = 100000;
      let mockNow = startTime;
      const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      expect(result.current.elapsedMs).toBe(0);

      // Advance time by 1000ms
      await act(async () => {
        mockNow += 1000;
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.elapsedMs).toBe(1000);

      // Pause session
      await act(async () => {
        result.current.pause();
      });

      // Advance time by 5000ms while paused
      await act(async () => {
        mockNow += 5000;
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.elapsedMs).toBe(1000);

      await act(async () => {
        await unmount();
      });

      dateSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
