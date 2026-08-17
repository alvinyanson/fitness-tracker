import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { HealthConnectStatusCard } from '@/components/HealthConnectStatusCard';

describe('HealthConnectStatusCard', () => {
  const onRetryMock = jest.fn();
  const onOpenPlayStoreMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly for checking status with no action buttons', async () => {
    const { getByText, queryAllByRole } = await render(
      <HealthConnectStatusCard
        availability="checking"
        onRetry={onRetryMock}
        onOpenPlayStore={onOpenPlayStoreMock}
      />,
    );

    expect(getByText('Health Connect')).toBeTruthy();
    expect(getByText('Checking...')).toBeTruthy();
    expect(getByText('Checking Health Connect status...')).toBeTruthy();
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('renders correctly for available status with no action buttons', async () => {
    const { getByText, queryAllByRole } = await render(
      <HealthConnectStatusCard
        availability="available"
        onRetry={onRetryMock}
        onOpenPlayStore={onOpenPlayStoreMock}
      />,
    );

    expect(getByText('Health Connect')).toBeTruthy();
    expect(getByText('Available')).toBeTruthy();
    expect(
      getByText('Health Connect is installed and ready to sync workout data.'),
    ).toBeTruthy();
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('renders correctly for unsupported status with no action buttons', async () => {
    const { getByText, queryAllByRole } = await render(
      <HealthConnectStatusCard
        availability="unsupported"
        onRetry={onRetryMock}
        onOpenPlayStore={onOpenPlayStoreMock}
      />,
    );

    expect(getByText('Health Connect')).toBeTruthy();
    expect(getByText('Not Supported')).toBeTruthy();
    expect(
      getByText(
        'Health Connect is not supported on this device or Android version.',
      ),
    ).toBeTruthy();
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('renders correctly for needs-install status with Play Store and Retry actions', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectStatusCard
        availability="needs-install"
        onRetry={onRetryMock}
        onOpenPlayStore={onOpenPlayStoreMock}
      />,
    );

    expect(getByText('Health Connect')).toBeTruthy();
    expect(getByText('Health Connect Not Installed')).toBeTruthy();
    expect(
      getByText(
        'Install Health Connect from the Google Play Store to sync workout data.',
      ),
    ).toBeTruthy();

    const playStoreBtn = getByRole('button', { name: 'Open Play Store' });
    expect(playStoreBtn).toBeTruthy();
    expect(playStoreBtn.props.accessibilityHint).toBe(
      'Opens Google Play Store to install or update Health Connect',
    );
    await act(async () => {
      fireEvent.press(playStoreBtn);
    });
    expect(onOpenPlayStoreMock).toHaveBeenCalledTimes(1);

    const retryBtn = getByRole('button', { name: 'Retry' });
    expect(retryBtn).toBeTruthy();
    expect(retryBtn.props.accessibilityHint).toBe(
      'Retries Health Connect availability check',
    );
    await act(async () => {
      fireEvent.press(retryBtn);
    });
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders correctly for needs-update status with Play Store and Retry actions', async () => {
    const { getByText, getByRole } = await render(
      <HealthConnectStatusCard
        availability="needs-update"
        onRetry={onRetryMock}
        onOpenPlayStore={onOpenPlayStoreMock}
      />,
    );

    expect(getByText('Health Connect')).toBeTruthy();
    expect(getByText('Update Required')).toBeTruthy();
    expect(
      getByText(
        'Health Connect needs to be updated to the latest version to sync workout data.',
      ),
    ).toBeTruthy();

    const playStoreBtn = getByRole('button', { name: 'Open Play Store' });
    await act(async () => {
      fireEvent.press(playStoreBtn);
    });
    expect(onOpenPlayStoreMock).toHaveBeenCalledTimes(1);

    const retryBtn = getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.press(retryBtn);
    });
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });
});
