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

  describe('units seeding', () => {
    async function loadFreshStore(
      measurementSystem: 'metric' | 'us' | 'uk' | null,
      persisted?: string,
    ) {
      let store!: typeof useSettingsStore;

      jest.isolateModules(() => {
        jest.doMock('expo-localization', () => ({
          getLocales: () => [{ languageCode: 'en', measurementSystem }],
        }));

        // The mmkv mock keeps its store in module state, so seed the isolated one.
        const storage = (
          require('react-native-mmkv') as typeof import('react-native-mmkv')
        ).createMMKV();
        storage.clearAll();
        if (persisted) {
          storage.set('@fitness_tracker/settings', persisted);
        }

        store = (
          require('@/store/settingsStore') as typeof import('@/store/settingsStore')
        ).useSettingsStore;
      });

      await act(async () => {
        await store.persist.rehydrate();
      });
      return store;
    }

    afterEach(() => {
      jest.dontMock('expo-localization');
      jest.resetModules();
    });

    it('seeds imperial from a device reporting us', async () => {
      const store = await loadFreshStore('us');
      expect(store.getState().units).toBe('imperial');
    });

    it('seeds imperial from a device reporting uk', async () => {
      const store = await loadFreshStore('uk');
      expect(store.getState().units).toBe('imperial');
    });

    it('seeds metric from a device reporting metric', async () => {
      const store = await loadFreshStore('metric');
      expect(store.getState().units).toBe('metric');
    });

    it('seeds metric when the device reports no measurement system', async () => {
      const store = await loadFreshStore(null);
      expect(store.getState().units).toBe('metric');
    });

    it('lets a persisted value win over the device seed', async () => {
      // Double-encoded: mmkvStorage JSON-encodes whatever zustand hands it.
      const store = await loadFreshStore(
        'us',
        JSON.stringify(
          JSON.stringify({
            state: { units: 'metric', language: 'en' },
            version: 0,
          }),
        ),
      );
      expect(store.getState().units).toBe('metric');
    });
  });
});
