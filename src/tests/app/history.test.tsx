import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import HistoryScreen from '@/app/history';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { setLocale } from '@/services/i18n/i18n';
import {
  getSessionIndex,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';
import { useSettingsStore } from '@/store/settingsStore';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  return {
    __esModule: true,
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      replace: jest.fn(),
    },
    useFocusEffect: (callback: () => void) => {
      const React = require('react');
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
    useLocalSearchParams: () => ({}),
    usePathname: () => '/history',
    Link: ({ children }: any) => children,
  };
});

describe('HistoryScreen', () => {
  let alertSpy: jest.SpyInstance;

  const mockSessionNewer: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1800000000000',
    startedAt: 1800000000000,
    endedAt: 1800003600000,
    stats: {
      durationMs: 3600000,
      avgHr: 150,
      maxHr: 170,
      minHr: 120,
      sampleCount: 3600,
      rawSampleCount: 3600,
    },
    samples: [],
  };

  const mockSessionOlder: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1700000000000',
    startedAt: 1700000000000,
    endedAt: 1700001800000,
    stats: {
      durationMs: 1800000,
      avgHr: 130,
      maxHr: 150,
      minHr: 100,
      sampleCount: 1800,
      rawSampleCount: 1800,
    },
    samples: [],
  };

  const mockNoHrSession: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1600000000000',
    startedAt: 1600000000000,
    endedAt: 1600000600000,
    stats: {
      durationMs: 600000,
      avgHr: null,
      maxHr: null,
      minHr: null,
      sampleCount: 0,
      rawSampleCount: 0,
    },
    samples: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders empty state when zero sessions exist in storage', async () => {
    const { getByText, queryByText } = await render(<HistoryScreen />);

    expect(getByText('No Sessions Yet')).toBeTruthy();
    expect(getByText('Complete a workout to see it appear here.')).toBeTruthy();
    expect(queryByText('Heart Rate Session')).toBeNull();
  });

  it('renders sessions in newest-first order with duration and avg HR', async () => {
    saveSession(mockSessionOlder);
    saveSession(mockSessionNewer);

    const { getAllByText, getByText } = await render(<HistoryScreen />);

    const titles = getAllByText('Heart Rate Session');
    expect(titles.length).toBe(2);

    expect(getByText('1:00:00')).toBeTruthy();
    expect(getByText('150 BPM')).toBeTruthy();

    expect(getByText('30:00')).toBeTruthy();
    expect(getByText('130 BPM')).toBeTruthy();

    const index = getSessionIndex();
    expect(index[0].id).toBe('1800000000000');
    expect(index[1].id).toBe('1700000000000');
  });

  it('renders "—" dash fallback for a session with null avgHr', async () => {
    saveSession(mockNoHrSession);

    const { getByText, queryByText } = await render(<HistoryScreen />);

    expect(getByText('Heart Rate Session')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
    expect(queryByText('null')).toBeNull();
    expect(queryByText('NaN')).toBeNull();
  });

  it('navigates to /summary/[id] on row tap', async () => {
    saveSession(mockSessionNewer);

    const { getByText } = await render(<HistoryScreen />);

    await act(async () => {
      fireEvent.press(getByText('150 BPM'));
    });

    expect(mockPush).toHaveBeenCalledWith('/summary/1800000000000');
  });

  it('handles long-press delete flow cancellation without deleting', async () => {
    saveSession(mockSessionOlder);
    saveSession(mockSessionNewer);

    const { getByText } = await render(<HistoryScreen />);

    await act(async () => {
      fireEvent(getByText('150 BPM'), 'longPress');
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Session?',
      'This will permanently delete this workout session. This action cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ]),
    );

    const alertButtons = alertSpy.mock.calls[0][2];
    const cancelButton = alertButtons.find(
      (btn: { style?: string }) => btn.style === 'cancel',
    );

    await act(async () => {
      cancelButton.onPress?.();
    });

    expect(getSessionIndex().length).toBe(2);
    expect(getByText('150 BPM')).toBeTruthy();
    expect(getByText('130 BPM')).toBeTruthy();
  });

  it('handles long-press delete confirmation by removing session from storage and updating list immediately', async () => {
    saveSession(mockSessionOlder);
    saveSession(mockSessionNewer);

    const { getByText, queryByText } = await render(<HistoryScreen />);

    await act(async () => {
      fireEvent(getByText('150 BPM'), 'longPress');
    });

    const alertButtons = alertSpy.mock.calls[0][2];
    const confirmButton = alertButtons.find(
      (btn: { style?: string }) => btn.style === 'destructive',
    );

    await act(async () => {
      confirmButton.onPress();
    });

    expect(queryByText('150 BPM')).toBeNull();
    expect(getByText('130 BPM')).toBeTruthy();

    const remaining = getSessionIndex();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('1700000000000');
  });
});
