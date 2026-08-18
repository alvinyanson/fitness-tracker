import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import SummaryScreen from '@/app/summary/[id]';
import { useHealthConnectSessionSync } from '@/hooks/useHealthConnectSessionSync';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { setLocale } from '@/services/i18n/i18n';
import {
  getSession,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';
import { useSettingsStore } from '@/store/settingsStore';
import type {
  HealthConnectSyncState,
  HealthConnectWriteFailureReason,
} from '@/interfaces/healthConnect';

const mockReplace = jest.fn();
let mockParams: { id?: string } = { id: '1700000000000' };

jest.mock('expo-router', () => {
  return {
    __esModule: true,
    router: {
      replace: (...args: unknown[]) => mockReplace(...args),
      push: jest.fn(),
    },
    useLocalSearchParams: () => mockParams,
    usePathname: () => `/summary/${mockParams.id}`,
    Link: ({ children }: any) => children,
  };
});

let mockSyncResult: {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  retry: jest.Mock;
} = {
  state: 'synced',
  reason: null,
  syncedAt: null,
  retry: jest.fn(),
};

jest.mock('@/hooks/useHealthConnectSessionSync', () => ({
  useHealthConnectSessionSync: jest.fn(() => mockSyncResult),
}));

describe('SummaryScreen', () => {
  let alertSpy: jest.SpyInstance;

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
    samples: [
      { timestamp: 1700000000000, bpm: 110, sensorContact: 'contactDetected' },
      { timestamp: 1700003600000, bpm: 175, sensorContact: 'contactDetected' },
    ],
  };

  const mockNoHrSession: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: '1800000000000',
    startedAt: 1800000000000,
    endedAt: 1800000060000,
    stats: {
      durationMs: 60000,
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
    mockSyncResult = {
      state: 'synced',
      reason: null,
      syncedAt: null,
      retry: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a stored session with stats, sample count, and formatted duration', async () => {
    saveSession(mockSession);
    mockParams = { id: '1700000000000' };

    const { getByText, queryByText } = await render(<SummaryScreen />);

    expect(getByText('Session Summary')).toBeTruthy();
    expect(getByText('1:00:00')).toBeTruthy();
    expect(getByText('145')).toBeTruthy();
    expect(getByText('175')).toBeTruthy();
    expect(getByText('110')).toBeTruthy();
    expect(getByText('3600')).toBeTruthy();
    expect(
      queryByText('No heart rate data was recorded during this session.'),
    ).toBeNull();
  });

  it('renders explicit no-HR message for a session with null avgHr', async () => {
    saveSession(mockNoHrSession);
    mockParams = { id: '1800000000000' };

    const { getByText, getAllByText } = await render(<SummaryScreen />);

    expect(getByText('Session Summary')).toBeTruthy();
    expect(getByText('01:00')).toBeTruthy();
    expect(getAllByText('—').length).toBe(3);
    expect(getByText('0')).toBeTruthy();
    expect(
      getByText('No heart rate data was recorded during this session.'),
    ).toBeTruthy();
  });

  it('renders not-found view when session id is not present in storage', async () => {
    mockParams = { id: 'non-existent-id' };

    const { getByText } = await render(<SummaryScreen />);

    expect(getByText('Session Not Found')).toBeTruthy();
    expect(
      getByText(
        'The requested workout session could not be found or has been deleted.',
      ),
    ).toBeTruthy();
    expect(getByText('Back to History')).toBeTruthy();
  });

  it('correctly normalizes array-typed route params', async () => {
    saveSession(mockSession);
    (mockParams as any) = { id: ['1700000000000', 'extra'] };

    const { getByText } = await render(<SummaryScreen />);

    expect(getByText('Session Summary')).toBeTruthy();
    expect(getByText('1:00:00')).toBeTruthy();
  });

  it('handles delete flow cancellation without deleting or navigating', async () => {
    saveSession(mockSession);
    mockParams = { id: '1700000000000' };

    const { getByText } = await render(<SummaryScreen />);

    await act(async () => {
      fireEvent.press(getByText('Delete Session'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Session?',
      'This will permanently delete this workout session. This action cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ]),
    );

    const buttons = alertSpy.mock.calls[0][2];
    const cancelButton = buttons.find(
      (btn: { style?: string }) => btn.style === 'cancel',
    );

    await act(async () => {
      cancelButton.onPress?.();
    });

    expect(getSession('1700000000000')).toEqual(mockSession);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('handles delete flow confirmation by removing session and navigating to /history', async () => {
    saveSession(mockSession);
    mockParams = { id: '1700000000000' };

    const { getByText } = await render(<SummaryScreen />);

    await act(async () => {
      fireEvent.press(getByText('Delete Session'));
    });

    const buttons = alertSpy.mock.calls[0][2];
    const confirmButton = buttons.find(
      (btn: { style?: string }) => btn.style === 'destructive',
    );

    await act(async () => {
      confirmButton.onPress();
    });

    expect(getSession('1700000000000')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/history');
  });

  describe('Health Connect sync row rendering', () => {
    it('renders synced state with timestamp', async () => {
      saveSession(mockSession);
      mockParams = { id: '1700000000000' };
      mockSyncResult = {
        state: 'synced',
        reason: null,
        syncedAt: new Date('2026-08-17T10:30:00Z').getTime(),
        retry: jest.fn(),
      };

      const { getByText } = await render(<SummaryScreen />);

      expect(getByText('Synced to Health Connect')).toBeTruthy();
      expect(getByText(/Synced at/)).toBeTruthy();
      expect(useHealthConnectSessionSync).toHaveBeenCalledWith(
        mockSession,
        expect.objectContaining({ title: 'Heart rate workout' }),
      );
    });

    it('renders unsynced state', async () => {
      saveSession(mockSession);
      mockParams = { id: '1700000000000' };
      mockSyncResult = {
        state: 'unsynced',
        reason: null,
        syncedAt: null,
        retry: jest.fn(),
      };

      const { getByText } = await render(<SummaryScreen />);

      expect(getByText('Not synced')).toBeTruthy();
    });

    it('renders failed state with reason and retry action', async () => {
      saveSession(mockSession);
      mockParams = { id: '1700000000000' };
      const retryMock = jest.fn();
      mockSyncResult = {
        state: 'failed',
        reason: 'permission-denied',
        syncedAt: null,
        retry: retryMock,
      };

      const { getByText } = await render(<SummaryScreen />);

      expect(getByText('Sync failed')).toBeTruthy();
      expect(
        getByText('Health Connect write permission was denied.'),
      ).toBeTruthy();

      const retryBtn = getByText('Retry');
      expect(retryBtn).toBeTruthy();
      fireEvent.press(retryBtn);
      expect(retryMock).toHaveBeenCalledTimes(1);
    });
  });
});
