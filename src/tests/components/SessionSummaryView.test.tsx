import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import { SessionSummaryView } from '@/components/SessionSummaryView';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { setLocale } from '@/services/i18n/i18n';
import {
  getSession,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';
import { useSettingsStore } from '@/store/settingsStore';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { replace: jest.fn(), push: jest.fn() },
  usePathname: () => '/history',
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks/useHealthConnectSessionSync', () => ({
  useHealthConnectSessionSync: () => ({
    state: 'synced',
    reason: null,
    syncedAt: null,
    retry: jest.fn(),
  }),
}));

const mockSession: PersistedSession = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  id: '1700000000000',
  startedAt: 1700000000000,
  endedAt: 1700003600000,
  stats: {
    durationMs: 3600000,
    avgHr: 145,
    maxHr: 175,
    minHr: 110,
    sampleCount: 3600,
    rawSampleCount: 3600,
  },
  samples: [],
};

describe('SessionSummaryView', () => {
  let alertSpy: jest.SpyInstance;

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

  it('renders the full summary for a stored session in the screen variant', async () => {
    saveSession(mockSession);

    const { getByText } = await render(
      <SessionSummaryView sessionId="1700000000000" />,
    );

    expect(getByText('Session Summary')).toBeTruthy();
    expect(getByText('Workout Complete')).toBeTruthy();
    expect(getByText('1:00:00')).toBeTruthy();
    expect(getByText('145')).toBeTruthy();
    expect(getByText('175')).toBeTruthy();
    expect(getByText('110')).toBeTruthy();
    expect(getByText('Back to History')).toBeTruthy();
  });

  it('drops the header and back link in the pane variant', async () => {
    saveSession(mockSession);

    const { getByText, queryByText } = await render(
      <SessionSummaryView sessionId="1700000000000" variant="pane" />,
    );

    expect(getByText('Workout Complete')).toBeTruthy();
    expect(queryByText('Session Summary')).toBeNull();
    expect(queryByText('Back to History')).toBeNull();
  });

  it('renders the placeholder when nothing is selected in a pane', async () => {
    const { getByText } = await render(
      <SessionSummaryView sessionId={null} variant="pane" />,
    );

    expect(getByText('Select a Session')).toBeTruthy();
    expect(
      getByText('Choose a workout from the list to see its summary here.'),
    ).toBeTruthy();
  });

  it('renders the not-found state for an unknown id', async () => {
    const { getByText } = await render(
      <SessionSummaryView sessionId="missing" />,
    );

    expect(getByText('Session Not Found')).toBeTruthy();
    expect(getByText('Back to History')).toBeTruthy();
  });

  it('renders the not-found state on the route when the id is absent', async () => {
    const { getByText, queryByText } = await render(
      <SessionSummaryView sessionId={null} />,
    );

    expect(getByText('Session Not Found')).toBeTruthy();
    expect(queryByText('Select a Session')).toBeNull();
  });

  it('deletes on confirmation and reports the id back to the caller', async () => {
    saveSession(mockSession);
    const onDeleted = jest.fn();

    const { getByLabelText } = await render(
      <SessionSummaryView
        sessionId="1700000000000"
        variant="pane"
        onDeleted={onDeleted}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Delete Session'));
    });

    const buttons = alertSpy.mock.calls[0]?.[2];
    const confirm = buttons.find(
      (btn: { style?: string }) => btn.style === 'destructive',
    );

    await act(async () => {
      confirm.onPress();
    });

    expect(getSession('1700000000000')).toBeNull();
    expect(onDeleted).toHaveBeenCalledWith('1700000000000');
  });

  it('renders the HR trend card for a session that has samples', async () => {
    saveSession({
      ...mockSession,
      id: '1900000000000',
      startedAt: 1900000000000,
      samples: Array.from({ length: 60 }, (_, i) => ({
        bpm: 120 + (i % 20),
        sensorContact: 'contactDetected' as const,
        timestamp: 1900000000000 + i * 10_000,
      })),
    });

    const { getByText, getByTestId } = await render(
      <SessionSummaryView sessionId="1900000000000" />,
    );

    expect(getByText('HEART RATE TREND')).toBeTruthy();

    await fireEvent(getByTestId('hr-trend-plot'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160 } },
    });

    expect(getByTestId('hr-trend-chart')).toBeTruthy();
  });

  it('renders no chart card for a session with no samples', async () => {
    saveSession(mockSession);

    const { queryByText, queryByTestId } = await render(
      <SessionSummaryView sessionId="1700000000000" />,
    );

    expect(queryByText('HEART RATE TREND')).toBeNull();
    expect(queryByTestId('hr-trend-chart')).toBeNull();
  });

  it('shows the no-heart-rate notice for a session without HR samples', async () => {
    saveSession({
      ...mockSession,
      id: '1800000000000',
      stats: {
        ...mockSession.stats,
        avgHr: null,
        maxHr: null,
        minHr: null,
        sampleCount: 0,
        rawSampleCount: 0,
      },
    });

    const { getByText } = await render(
      <SessionSummaryView sessionId="1800000000000" />,
    );

    expect(
      getByText('No heart rate data was recorded during this session.'),
    ).toBeTruthy();
  });
});
