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
    const { getAllByRole } = await render(<SettingsScreen />);

    const buttons = getAllByRole('button');
    expect(buttons.length).toBe(2);

    const btn0 = buttons[0];
    const btn1 = buttons[1];
    expect(btn0).toBeDefined();
    expect(btn1).toBeDefined();

    // English option
    expect(btn0!.props.accessibilityRole).toBe('button');
    expect(btn0!.props.accessibilityLabel).toBe('English');
    expect(btn0!.props.accessibilityHint).toBe('Selects this language');
    expect(btn0!.props.accessibilityState).toEqual({ selected: true });

    // Japanese option
    expect(btn1!.props.accessibilityRole).toBe('button');
    expect(btn1!.props.accessibilityLabel).toBe('Japanese');
    expect(btn1!.props.accessibilityHint).toBe('Selects this language');
    expect(btn1!.props.accessibilityState).toEqual({ selected: false });
  });

  it('switches language and updates accessibility state and labels', async () => {
    const { getAllByRole, findByText } = await render(<SettingsScreen />);

    const buttons = getAllByRole('button');
    const btn1 = buttons[1];
    expect(btn1).toBeDefined();
    await act(async () => {
      fireEvent.press(btn1!);
    });

    expect(useSettingsStore.getState().language).toBe('ja');
    expect(await findByText('設定')).toBeTruthy();
  });
});
