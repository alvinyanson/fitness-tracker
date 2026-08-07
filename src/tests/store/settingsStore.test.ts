import { useSettingsStore } from '@/store/settingsStore';
import { createMMKV } from 'react-native-mmkv';
import { act } from '@testing-library/react-native';

describe('settingsStore', () => {
  beforeEach(async () => {
    createMMKV().clearAll();
    await act(async () => {
      useSettingsStore.setState({ language: 'en', units: 'metric' });
    });
  });

  it('allows updating language state', async () => {
    expect(useSettingsStore.getState().language).toBe('en');
    await act(async () => {
      useSettingsStore.getState().setLanguage('ja');
    });
    expect(useSettingsStore.getState().language).toBe('ja');
  });

  it('allows updating units state', async () => {
    expect(useSettingsStore.getState().units).toBe('metric');
    await act(async () => {
      useSettingsStore.getState().setUnits('imperial');
    });
    expect(useSettingsStore.getState().units).toBe('imperial');
  });
});
