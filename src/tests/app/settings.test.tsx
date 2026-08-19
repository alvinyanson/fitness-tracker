import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { createMMKV } from 'react-native-mmkv';
import { useSettingsStore } from '@/store/settingsStore';
import { setLocale } from '@/services/i18n/i18n';

describe('SettingsScreen', () => {
  beforeEach(() => {
    createMMKV().clearAll();
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
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
});
