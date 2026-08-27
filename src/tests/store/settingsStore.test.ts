import { useSettingsStore } from '@/store/settingsStore';
import { createMMKV } from 'react-native-mmkv';
import { act } from '@testing-library/react-native';

describe('settingsStore', () => {
  beforeEach(async () => {
    createMMKV().clearAll();
    await act(async () => {
      useSettingsStore.setState({
        language: 'en',
        units: 'metric',
        updatedAt: 0,
      });
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

  describe('updatedAt', () => {
    it('stamps a fresh timestamp when units change', async () => {
      const before = Date.now();
      await act(async () => {
        useSettingsStore.getState().setUnits('imperial');
      });
      expect(useSettingsStore.getState().updatedAt).toBeGreaterThanOrEqual(
        before,
      );
    });

    it('stamps a fresh timestamp when the language changes', async () => {
      const before = Date.now();
      await act(async () => {
        useSettingsStore.getState().setLanguage('ja');
      });
      expect(useSettingsStore.getState().updatedAt).toBeGreaterThanOrEqual(
        before,
      );
    });

    it('adopts a remote updatedAt verbatim instead of stamping a new one', async () => {
      await act(async () => {
        useSettingsStore.getState().applyRemoteSettings({
          units: 'imperial',
          language: 'ja',
          updatedAt: 1234,
        });
      });
      const state = useSettingsStore.getState();
      expect(state.units).toBe('imperial');
      expect(state.language).toBe('ja');
      expect(state.updatedAt).toBe(1234);
    });
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
