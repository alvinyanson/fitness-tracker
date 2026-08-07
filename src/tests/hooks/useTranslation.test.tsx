import React from 'react';
import { Text, Button } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { createMMKV } from 'react-native-mmkv';

function TestProbe() {
  const { t, language, setLanguage } = useTranslation();
  return (
    <>
      <Text testID="title">{t('pairing.title')}</Text>
      <Text testID="current-lang">{language}</Text>
      <Button title="Switch to JA" onPress={() => setLanguage('ja')} />
      <Button title="Switch to EN" onPress={() => setLanguage('en')} />
    </>
  );
}

describe('useTranslation hook', () => {
  beforeEach(async () => {
    createMMKV().clearAll();
    await act(async () => {
      useSettingsStore.setState({ language: 'en', units: 'metric' });
    });
  });

  it('renders translated text using active language', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('title')).toHaveTextContent('Pairing');
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
  });

  it('re-renders component immediately when language is changed via setLanguage', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('title')).toHaveTextContent('Pairing');

    await act(async () => {
      fireEvent.press(screen.getByText('Switch to JA'));
    });

    expect(screen.getByTestId('title')).toHaveTextContent('ペアリング');
    expect(screen.getByTestId('current-lang')).toHaveTextContent('ja');
    expect(useSettingsStore.getState().language).toBe('ja');
  });
});
