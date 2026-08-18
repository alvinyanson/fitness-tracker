import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HealthConnectSyncBadge } from '@/components/HealthConnectSyncBadge';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

describe('HealthConnectSyncBadge', () => {
  const onRetryMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
  });

  it('renders synced state with formatted synced time', async () => {
    const testDate = new Date('2026-08-17T10:30:00Z').getTime();

    const { getByText, queryByText } = await render(
      <HealthConnectSyncBadge
        state="synced"
        reason={null}
        syncedAt={testDate}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Synced to Health Connect')).toBeTruthy();
    expect(queryByText(/Synced at/)).toBeTruthy();
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders syncing state without actions', async () => {
    const { getByText, queryByText } = await render(
      <HealthConnectSyncBadge
        state="syncing"
        reason={null}
        syncedAt={null}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Syncing to Health Connect…')).toBeTruthy();
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders unsynced state without actions', async () => {
    const { getByText, queryByText } = await render(
      <HealthConnectSyncBadge
        state="unsynced"
        reason={null}
        syncedAt={null}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Not synced')).toBeTruthy();
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders failed state with unavailable reason and clickable retry action', async () => {
    const { getByText } = await render(
      <HealthConnectSyncBadge
        state="failed"
        reason="unavailable"
        syncedAt={null}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Sync failed')).toBeTruthy();
    expect(
      getByText('Health Connect is not available on this device.'),
    ).toBeTruthy();

    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders failed state with permission-denied reason', async () => {
    const { getByText } = await render(
      <HealthConnectSyncBadge
        state="failed"
        reason="permission-denied"
        syncedAt={null}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Sync failed')).toBeTruthy();
    expect(
      getByText('Health Connect write permission was denied.'),
    ).toBeTruthy();
  });

  it('renders failed state with write-failed reason', async () => {
    const { getByText } = await render(
      <HealthConnectSyncBadge
        state="failed"
        reason="write-failed"
        syncedAt={null}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('Sync failed')).toBeTruthy();
    expect(
      getByText('Failed to write workout to Health Connect.'),
    ).toBeTruthy();
  });
});
