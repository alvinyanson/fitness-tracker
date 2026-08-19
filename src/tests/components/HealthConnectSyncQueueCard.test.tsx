import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HealthConnectSyncQueueCard } from '@/components/HealthConnectSyncQueueCard';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

describe('HealthConnectSyncQueueCard', () => {
  const onSyncNowMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
  });

  it('renders nothing pending when pending is 0 and disables Sync Now', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 0, eligible: 0, abandoned: 0 }}
        status="idle"
        lastResult={null}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(getByText('Sync Queue')).toBeTruthy();
    expect(getByText('All workouts are synced')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });

    fireEvent.press(button);
    expect(onSyncNowMock).not.toHaveBeenCalled();
  });

  it('renders pending count and enables button when pending > 0', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 3, eligible: 2, abandoned: 0 }}
        status="idle"
        lastResult={null}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(getByText('3 workout(s) pending sync')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });

    fireEvent.press(button);
    expect(onSyncNowMock).toHaveBeenCalledTimes(1);
  });

  it('renders abandoned count when abandoned > 0 and enables button', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 0, eligible: 0, abandoned: 2 }}
        status="idle"
        lastResult={null}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(
      getByText('2 workout(s) abandoned after repeated failures'),
    ).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });

    fireEvent.press(button);
    expect(onSyncNowMock).toHaveBeenCalledTimes(1);
  });

  it('renders flushing state and sets busy on button', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 2, eligible: 2, abandoned: 0 }}
        status="flushing"
        lastResult={null}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(getByText('Syncing workouts…')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('renders lastResult when skipped for unavailable or permission-denied', async () => {
    const { getByText, rerender } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 1, eligible: 1, abandoned: 0 }}
        status="idle"
        lastResult={{
          attempted: 0,
          synced: 0,
          failed: 0,
          abandoned: 0,
          deferred: 0,
          skipped: 'unavailable',
          finishedAt: 1700000000000,
        }}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(getByText('Health Connect is unavailable')).toBeTruthy();

    await rerender(
      <HealthConnectSyncQueueCard
        summary={{ pending: 1, eligible: 1, abandoned: 0 }}
        status="idle"
        lastResult={{
          attempted: 0,
          synced: 0,
          failed: 0,
          abandoned: 0,
          deferred: 0,
          skipped: 'permission-denied',
          finishedAt: 1700000000000,
        }}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(
      getByText('Health Connect permissions required to sync'),
    ).toBeTruthy();
  });

  it('renders lastResult sync/fail counts', async () => {
    const { getByText } = await render(
      <HealthConnectSyncQueueCard
        summary={{ pending: 0, eligible: 0, abandoned: 0 }}
        status="idle"
        lastResult={{
          attempted: 3,
          synced: 2,
          failed: 1,
          abandoned: 0,
          deferred: 0,
          skipped: null,
          finishedAt: 1700000000000,
        }}
        onSyncNow={onSyncNowMock}
      />,
    );

    expect(
      getByText(
        'Successfully synced 2 workout(s) · Failed to sync 1 workout(s)',
      ),
    ).toBeTruthy();
  });
});
