import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SettingsScreen from '@/app/(tabs)/settings';
import { createMMKV } from 'react-native-mmkv';
import { useSettingsStore } from '@/store/settingsStore';
import { setLocale } from '@/services/i18n/i18n';
import { useNetworkStore } from '@/store/networkStore';
import { useAuthStore } from '@/store/authStore';

// jest-expo leaves `expoConfig.extra` undefined, which useAuth reads as an unconfigured
// Firebase project and reports as 'unknown'. Supply the id so the account states render.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleWebClientId: 'web-client-id' } } },
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    withSequence: (...args: unknown[]) => args[args.length - 1],
  };
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
    useNetworkStore.setState({ status: 'unknown' });
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      errorReason: null,
    });
  });

  it('renders settings title with header role', async () => {
    const { getByText } = await render(<SettingsScreen />);
    const title = getByText('Settings');
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('renders language option buttons with accessibility label, hint, and selected state', async () => {
    const { getByRole } = await render(<SettingsScreen />);

    const enButton = getByRole('button', { name: 'English' });
    const jaButton = getByRole('button', { name: 'Japanese' });

    expect(enButton).toBeDefined();
    expect(enButton.props.accessibilityRole).toBe('button');
    expect(enButton.props.accessibilityLabel).toBe('English');
    expect(enButton.props.accessibilityHint).toBe('Selects this language');
    expect(enButton.props.accessibilityState).toEqual({ selected: true });

    expect(jaButton).toBeDefined();
    expect(jaButton.props.accessibilityRole).toBe('button');
    expect(jaButton.props.accessibilityLabel).toBe('Japanese');
    expect(jaButton.props.accessibilityHint).toBe('Selects this language');
    expect(jaButton.props.accessibilityState).toEqual({ selected: false });
  });

  it('switches language and updates accessibility state and labels', async () => {
    const { getByRole, findByText } = await render(<SettingsScreen />);

    const jaButton = getByRole('button', { name: 'Japanese' });
    expect(jaButton).toBeDefined();
    await act(async () => {
      fireEvent.press(jaButton);
    });

    expect(useSettingsStore.getState().language).toBe('ja');
    expect(await findByText('設定')).toBeTruthy();
  });

  it('renders units segments with accessibility label, hint, and selected state', async () => {
    const { getByRole } = await render(<SettingsScreen />);

    const metric = getByRole('button', { name: 'Metric' });
    const imperial = getByRole('button', { name: 'Imperial' });

    expect(metric.props.accessibilityRole).toBe('button');
    expect(metric.props.accessibilityLabel).toBe('Metric');
    expect(metric.props.accessibilityHint).toBe(
      'Selects this measurement system',
    );
    expect(metric.props.accessibilityState).toEqual({ selected: true });

    expect(imperial.props.accessibilityHint).toBe(
      'Selects this measurement system',
    );
    expect(imperial.props.accessibilityState).toEqual({ selected: false });
  });

  it('switches the unit system when Imperial is pressed', async () => {
    const { getByRole } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Imperial' }));
    });

    expect(useSettingsStore.getState().units).toBe('imperial');
    expect(
      getByRole('button', { name: 'Imperial' }).props.accessibilityState,
    ).toEqual({ selected: true });
  });

  it('renders health connect status section', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('Health Connect')).toBeTruthy();
  });

  it('renders sync queue card and allows tapping Sync Now when items are pending', async () => {
    const { getByText, queryByText } = await render(<SettingsScreen />);
    expect(getByText('Sync Queue')).toBeTruthy();
    expect(getByText('All workouts are synced')).toBeTruthy();
    expect(queryByText('Sync Now')).toBeTruthy();
  });
  it('shows the offline banner when the network store is offline', async () => {
    useNetworkStore.setState({ status: 'offline' });

    const { getByRole, getByText } = await render(<SettingsScreen />);

    expect(getByText("You're offline")).toBeTruthy();
    expect(getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
  });

  it('keeps the offline banner collapsed when online', async () => {
    useNetworkStore.setState({ status: 'online' });

    const { queryByRole, queryByText } = await render(<SettingsScreen />);

    expect(queryByRole('alert')).toBeNull();
    expect(queryByText("You're offline")).toBeNull();
  });

  it('keeps the offline banner collapsed while the status is unknown', async () => {
    const { queryByRole, queryByText } = await render(<SettingsScreen />);

    expect(useNetworkStore.getState().status).toBe('unknown');
    expect(queryByRole('alert')).toBeNull();
    expect(queryByText("You're offline")).toBeNull();
  });
});

describe('SettingsScreen account section', () => {
  beforeEach(() => {
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
    useNetworkStore.setState({ status: 'online' });
    useAuthStore.setState({ status: 'unknown', user: null, errorReason: null });
  });

  it('renders the account section header', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('Account')).toBeTruthy();
  });

  it('shows the placeholder while the auth status is unknown', async () => {
    const { getByText, queryByText } = await render(<SettingsScreen />);

    expect(getByText('Checking…')).toBeTruthy();
    expect(queryByText('Sign in with Google')).toBeNull();
  });

  it('shows the sign-in button when signed out', async () => {
    useAuthStore.setState({ status: 'signed-out' });

    const { getByRole } = await render(<SettingsScreen />);
    expect(getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  });

  it('shows the signed-in identity and a log out row', async () => {
    useAuthStore.setState({
      status: 'signed-in',
      user: {
        uid: 'uid-1',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        photoURL: null,
      },
    });

    const { getByRole, getByText } = await render(<SettingsScreen />);
    expect(getByText('Alex Rivera')).toBeTruthy();
    expect(getByRole('button', { name: 'Log Out' })).toBeTruthy();
  });

  it('leaves every other control ungated while signed out', async () => {
    useAuthStore.setState({ status: 'signed-out' });

    const { getByRole } = await render(<SettingsScreen />);

    for (const name of ['Metric', 'Imperial', 'English', 'Japanese']) {
      const control = getByRole('button', { name });
      expect(control.props.accessibilityState?.disabled).not.toBe(true);
    }
  });
});

describe('SettingsScreen guest account', () => {
  beforeEach(() => {
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
    useNetworkStore.setState({ status: 'online' });
    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      errorReason: null,
      pendingProvider: null,
    });
  });

  it('offers Continue as Guest when signed out', async () => {
    const { getByRole } = await render(<SettingsScreen />);
    expect(getByRole('button', { name: 'Continue as Guest' })).toBeTruthy();
  });

  it('shows the guest identity when signed in anonymously', async () => {
    useAuthStore.setState({
      status: 'signed-in',
      user: { uid: 'anon-uid', isAnonymous: true },
    });

    const { getByRole, getByText } = await render(<SettingsScreen />);
    expect(getByText('Guest')).toBeTruthy();
    expect(getByRole('button', { name: 'Log Out' })).toBeTruthy();
  });
});
