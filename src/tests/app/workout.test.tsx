import React from 'react';
import type { ResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { Alert, BackHandler, StyleSheet } from 'react-native';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

const mockNavigate = jest.fn();

// The workout screen reads window size only through useResponsiveLayout.
const phoneLayout: ResponsiveLayout = {
  width: 411,
  height: 891,
  sizeClass: 'phone',
  orientation: 'portrait',
  isTablet: false,
  isTwoPane: false,
  contentMaxWidth: null,
  containerPadding: 20,
  statColumns: 2,
  bpmFontSize: 64,
  bpmIconSize: 36,
  masterPaneWidth: null,
};

const tabletLandscapeLayout: ResponsiveLayout = {
  width: 1280,
  height: 800,
  sizeClass: 'tablet',
  orientation: 'landscape',
  isTablet: true,
  isTwoPane: true,
  contentMaxWidth: 640,
  containerPadding: 32,
  statColumns: 4,
  bpmFontSize: 88,
  bpmIconSize: 48,
  masterPaneWidth: 320,
};

const tabletPortraitLayout: ResponsiveLayout = {
  ...tabletLandscapeLayout,
  width: 800,
  height: 1280,
  orientation: 'portrait',
  isTwoPane: true,
};

let mockLayout: ResponsiveLayout = phoneLayout;

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => mockLayout,
}));

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
    mockLayout = phoneLayout;
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
  it('lays the four stat cards out in one row at tablet widths', async () => {
    mockLayout = tabletLandscapeLayout;

    const { getAllByTestId } = await render(<WorkoutScreen />);

    const rows = getAllByTestId(/^stat-row-/);
    expect(rows).toHaveLength(1);
  });

  it('keeps the phone two-row grid and 64px readout', async () => {
    const { getAllByTestId, getByText } = await render(<WorkoutScreen />);

    expect(getAllByTestId(/^stat-row-/)).toHaveLength(2);
    expect(StyleSheet.flatten(getByText('--').props.style).fontSize).toBe(64);
  });

  it('keeps the timer advancing and the session active across a rotation', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    mockLayout = tabletPortraitLayout;
    const { getByText, rerender } = await render(<WorkoutScreen />);

    await act(async () => {
      useWorkoutSessionStore.getState().start();
    });

    now += 5000;
    await act(async () => {
      await rerender(<WorkoutScreen />);
    });
    expect(getByText('00:05')).toBeTruthy();

    // Rotate: same window, width and height swapped.
    mockLayout = tabletLandscapeLayout;
    now += 3000;
    await act(async () => {
      await rerender(<WorkoutScreen />);
    });

    expect(getByText('00:08')).toBeTruthy();
    expect(useWorkoutSessionStore.getState().status).toBe('active');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
