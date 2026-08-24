import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => {
  return {
    __esModule: true,
    router: {
      navigate: (...args: unknown[]) => mockNavigate(...args),
      push: jest.fn(),
    },
    useFocusEffect: (cb: any) => cb(),
    usePathname: () => '/workout',
    Link: ({ children }: any) => children,
  };
});

jest.mock('@/hooks/useWorkoutSession', () => {
  const ReactModule = require('react');
  const { useWorkoutSessionStore } = require('@/store/workoutSessionStore');
  const {
    getRollingAverageBpm,
  } = require('@/services/session/rollingAverageBpm');
  const {
    persistCompletedSession,
  } = require('@/services/session/persistSession');

  return {
    useWorkoutSession: () => {
      const status = useWorkoutSessionStore((state: any) => state.status);
      const reconnecting = useWorkoutSessionStore(
        (state: any) => state.reconnecting,
      );
      const samples = useWorkoutSessionStore((state: any) => state.samples);
      const start = useWorkoutSessionStore((state: any) => state.start);
      const pause = useWorkoutSessionStore((state: any) => state.pause);
      const resume = useWorkoutSessionStore((state: any) => state.resume);
      const getElapsedMs = useWorkoutSessionStore(
        (state: any) => state.getElapsedMs,
      );

      const [lastCompletedSessionId, setLastCompletedSessionId] =
        ReactModule.useState(null);

      const stop = ReactModule.useCallback(() => {
        const currentStatus = useWorkoutSessionStore.getState().status;
        if (currentStatus !== 'active' && currentStatus !== 'paused') {
          useWorkoutSessionStore.getState().stop();
          return;
        }

        useWorkoutSessionStore.getState().stop();
        const stoppedSnapshot = useWorkoutSessionStore.getState();
        const record = persistCompletedSession(stoppedSnapshot);
        setLastCompletedSessionId(record.id);
      }, []);

      const elapsedMs = getElapsedMs();
      const currentBpm =
        samples.length > 0 ? samples[samples.length - 1].bpm : null;
      const rollingAverageBpm = getRollingAverageBpm(samples, Date.now());

      return {
        status,
        reconnecting,
        elapsedMs,
        sampleCount: samples.length,
        currentBpm,
        rollingAverageBpm,
        lastCompletedSessionId,
        start,
        pause,
        resume,
        stop,
      };
    },
  };
});

jest.mock('@/hooks/useDevicePairing', () => ({
  useDevicePairing: () => ({
    connection: { state: 'idle' },
    devices: [],
    pairedDevice: null,
    isScanning: false,
    isAutoReconnecting: false,
    scan: jest.fn(),
    stopScan: jest.fn(),
    connectToDevice: jest.fn(),
    disconnect: jest.fn(),
    unpair: jest.fn(),
    cancelReconnect: jest.fn(),
  }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
    },
    View,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    withSequence: (...args: unknown[]) => args[args.length - 1],
  };
});

import WorkoutScreen from '@/app/(tabs)/workout';
import { createMMKV } from 'react-native-mmkv';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

describe('WorkoutScreen', () => {
  let backHandlerListeners: (() => boolean)[] = [];
  let alertSpy: jest.SpyInstance;

  const resetStore = () => {
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
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
    backHandlerListeners = [];
    resetStore();

    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((event, handler) => {
        if (event === 'hardwareBackPress') {
          const fn = handler as () => boolean;
          backHandlerListeners.push(fn);
          return {
            remove: jest.fn(() => {
              backHandlerListeners = backHandlerListeners.filter(
                (l) => l !== fn,
              );
            }),
          } as any;
        }
        return { remove: jest.fn() } as any;
      });

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    resetStore();
    jest.restoreAllMocks();
  });

  it('renders initial idle UI with Start button and Back to Pairing link', async () => {
    const { getByText, queryByText } = await render(<WorkoutScreen />);

    expect(getByText('Live Workout')).toBeTruthy();
    expect(getByText('00:00')).toBeTruthy();
    expect(getByText('--')).toBeTruthy();
    expect(getByText('30s Avg: --')).toBeTruthy();
    expect(getByText('Start')).toBeTruthy();
    expect(getByText('Back to Pairing')).toBeTruthy();
    expect(queryByText('Reconnecting…')).toBeNull();
  });

  it('executes Start -> Pause -> Resume -> Stop flow and updates UI state', async () => {
    const { getByText, queryByText } = await render(<WorkoutScreen />);

    // Press Start
    await act(async () => {
      fireEvent.press(getByText('Start'));
    });

    const expectedId = String(useWorkoutSessionStore.getState().startedAt);

    expect(useWorkoutSessionStore.getState().status).toBe('active');
    expect(getByText('Pause')).toBeTruthy();
    expect(getByText('Stop')).toBeTruthy();
    expect(queryByText('Start')).toBeNull();
    expect(queryByText('Back to Pairing')).toBeNull();

    // Press Pause
    await act(async () => {
      fireEvent.press(getByText('Pause'));
    });

    expect(useWorkoutSessionStore.getState().status).toBe('paused');
    expect(getByText('Resume')).toBeTruthy();
    expect(getByText('Stop')).toBeTruthy();
    expect(queryByText('Pause')).toBeNull();

    // Press Resume
    await act(async () => {
      fireEvent.press(getByText('Resume'));
    });

    expect(useWorkoutSessionStore.getState().status).toBe('active');
    expect(getByText('Pause')).toBeTruthy();

    // Press Stop
    await act(async () => {
      fireEvent.press(getByText('Stop'));
    });

    expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    expect(mockNavigate).toHaveBeenCalledWith(`/summary/${expectedId}`);
  });

  it('displays reconnecting banner without pausing timer or disabling Stop button', async () => {
    const { getByText, queryByText } = await render(<WorkoutScreen />);

    await act(async () => {
      useWorkoutSessionStore.getState().start();
    });

    const expectedId = String(useWorkoutSessionStore.getState().startedAt);
    const initialElapsed = useWorkoutSessionStore.getState().getElapsedMs();
    expect(queryByText('Reconnecting…')).toBeNull();

    // Set reconnecting flag on store
    await act(async () => {
      useWorkoutSessionStore.getState().setReconnecting(true);
    });

    expect(getByText('Reconnecting…')).toBeTruthy();

    // Verify elapsedMs continues advancing while reconnecting is true
    const reconnectingElapsed = useWorkoutSessionStore
      .getState()
      .getElapsedMs();
    expect(reconnectingElapsed).toBeGreaterThanOrEqual(initialElapsed);
    expect(useWorkoutSessionStore.getState().status).toBe('active');

    // Stop remains pressable
    const stopBtn = getByText('Stop');
    expect(stopBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(stopBtn);
    });

    expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    expect(mockNavigate).toHaveBeenCalledWith(`/summary/${expectedId}`);
  });

  it('hardware back press is not intercepted when idle', async () => {
    await render(<WorkoutScreen />);

    expect(backHandlerListeners.length).toBeGreaterThan(0);
    const activeListener =
      backHandlerListeners[backHandlerListeners.length - 1];
    expect(activeListener).toBeDefined();
    const result = activeListener!();

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('hardware back press while active shows confirm alert; cancel leaves session running', async () => {
    await render(<WorkoutScreen />);

    await act(async () => {
      useWorkoutSessionStore.getState().start();
    });

    expect(backHandlerListeners.length).toBeGreaterThan(0);
    const activeListener =
      backHandlerListeners[backHandlerListeners.length - 1];
    expect(activeListener).toBeDefined();

    let isHandled = false;
    await act(async () => {
      isHandled = activeListener!();
    });

    expect(isHandled).toBe(true);
    expect(alertSpy).toHaveBeenCalledWith(
      'End Workout?',
      'Your live workout session is in progress. Ending now will complete the session.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep Working Out', style: 'cancel' }),
        expect.objectContaining({
          text: 'End Session',
          style: 'destructive',
        }),
      ]),
    );

    // Cancel leaves session active
    expect(useWorkoutSessionStore.getState().status).toBe('active');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('hardware back press while active and confirming alert stops session and navigates', async () => {
    await render(<WorkoutScreen />);

    await act(async () => {
      useWorkoutSessionStore.getState().start();
    });

    const expectedId = String(useWorkoutSessionStore.getState().startedAt);

    expect(backHandlerListeners.length).toBeGreaterThan(0);
    const activeListener =
      backHandlerListeners[backHandlerListeners.length - 1];
    expect(activeListener).toBeDefined();

    await act(async () => {
      activeListener!();
    });

    const alertButtons = alertSpy.mock.calls[0]?.[2];
    const confirmButton = alertButtons?.find(
      (btn: { style?: string }) => btn.style === 'destructive',
    );

    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.onPress();
    });

    expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    expect(mockNavigate).toHaveBeenCalledWith(`/summary/${expectedId}`);
  });

  it('hardware back press while paused shows confirm alert and confirming alert stops session and navigates', async () => {
    await render(<WorkoutScreen />);

    await act(async () => {
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().pause();
    });

    const expectedId = String(useWorkoutSessionStore.getState().startedAt);

    expect(useWorkoutSessionStore.getState().status).toBe('paused');
    expect(backHandlerListeners.length).toBeGreaterThan(0);

    const activeListener =
      backHandlerListeners[backHandlerListeners.length - 1];
    expect(activeListener).toBeDefined();

    let isHandled = false;
    await act(async () => {
      isHandled = activeListener!();
    });

    expect(isHandled).toBe(true);
    expect(alertSpy).toHaveBeenCalledWith(
      'End Workout?',
      'Your live workout session is in progress. Ending now will complete the session.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep Working Out', style: 'cancel' }),
        expect.objectContaining({
          text: 'End Session',
          style: 'destructive',
        }),
      ]),
    );

    const alertButtons = alertSpy.mock.calls[0][2];
    const confirmButton = alertButtons.find(
      (btn: { style?: string }) => btn.style === 'destructive',
    );

    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton.onPress();
    });

    expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    expect(mockNavigate).toHaveBeenCalledWith(`/summary/${expectedId}`);
  });
});
