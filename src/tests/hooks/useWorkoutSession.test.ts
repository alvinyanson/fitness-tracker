import { act, renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { BleManager } from 'react-native-ble-plx';
import { createMMKV } from 'react-native-mmkv';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { getBleService, resetBleService } from '@/services/ble/bleService';
import { HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID } from '@/services/ble/gattProfiles';
import {
  getSession,
  getSessionIndex,
} from '@/services/storage/sessionHistoryStorage';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(true),
  deactivateKeepAwake: jest.fn().mockResolvedValue(true),
}));

describe('useWorkoutSession', () => {
  let managerInstance: BleManager;

  const resetStore = () => {
    createMMKV().clearAll();
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
    resetBleService();
    managerInstance = (getBleService() as any).manager;
  });

  afterEach(() => {
    resetBleService();
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
        await getBleService().connect('dev-1');
      });

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      expect(result.current.status).toBe('active');
      expect(result.current.reconnecting).toBe(false);

      // Disconnect device
      await act(async () => {
        await getBleService().disconnect();
      });

      expect(result.current.status).toBe('active');
      expect(result.current.reconnecting).toBe(true);

      // Reconnect device
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await getBleService().connect('dev-1');
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
        await getBleService().connect('dev-1');
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

  describe('currentBpm and rollingAverageBpm derivation', () => {
    it('returns null for currentBpm and rollingAverageBpm when no samples exist', async () => {
      const { result, unmount } = await renderHook(() => useWorkoutSession());

      expect(result.current.currentBpm).toBeNull();
      expect(result.current.rollingAverageBpm).toBeNull();

      await act(async () => {
        await unmount();
      });
    });

    it('derives currentBpm and rollingAverageBpm from ingested samples', async () => {
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await getBleService().connect('dev-1');
      });

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      // Emit sample 1 (80 bpm -> 'AFA=')
      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFA=',
        );
      });

      expect(result.current.currentBpm).toBe(80);
      expect(result.current.rollingAverageBpm).toBe(80);

      // Emit sample 2 (84 bpm -> 'AFQ=')
      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFQ=',
        );
      });

      expect(result.current.currentBpm).toBe(84);
      expect(result.current.rollingAverageBpm).toBe(82); // Math.round((80 + 84) / 2)

      await act(async () => {
        await unmount();
      });
    });

    it('retains last known currentBpm when paused or reconnecting', async () => {
      managerInstance.__connectOutcome('success');
      await act(async () => {
        await getBleService().connect('dev-1');
      });

      const { result, unmount } = await renderHook(() => useWorkoutSession());

      await act(async () => {
        result.current.start();
      });

      await act(async () => {
        managerInstance.__emitNotification(
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          'AFA=', // 80 bpm
        );
      });

      expect(result.current.currentBpm).toBe(80);

      // Disconnect -> reconnecting
      await act(async () => {
        await getBleService().disconnect();
      });

      expect(result.current.reconnecting).toBe(true);
      expect(result.current.currentBpm).toBe(80);

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

  describe('persistence behavior on stop', () => {
    it('persists session and sets lastCompletedSessionId when stopping active/paused session', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(150000);
      const { result, unmount } = await renderHook(() => useWorkoutSession());

      expect(result.current.lastCompletedSessionId).toBeNull();

      await act(async () => {
        result.current.start();
      });

      expect(result.current.status).toBe('active');

      await act(async () => {
        result.current.stop();
      });

      expect(result.current.status).toBe('stopped');
      expect(result.current.lastCompletedSessionId).toBe('150000');

      const stored = getSession('150000');
      expect(stored).not.toBeNull();
      expect(stored?.id).toBe('150000');

      await act(async () => {
        await unmount();
      });

      nowSpy.mockRestore();
    });

    it('does not persist session or change lastCompletedSessionId when stopping an idle session', async () => {
      const { result, unmount } = await renderHook(() => useWorkoutSession());

      expect(result.current.status).toBe('idle');
      expect(result.current.lastCompletedSessionId).toBeNull();

      await act(async () => {
        result.current.stop();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.lastCompletedSessionId).toBeNull();
      expect(getSessionIndex()).toEqual([]);

      await act(async () => {
        await unmount();
      });
    });
  });
});
