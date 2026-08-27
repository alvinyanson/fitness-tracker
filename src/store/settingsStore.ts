import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getItem, setItem, removeItem } from '@/services/storage/mmkvStorage';
import { LocaleCode } from '@/interfaces/i18n';
import { UnitSystem } from '@/interfaces/units';
import type { UserPreferences } from '@/interfaces/preferences';
import { getDeviceLocale } from '@/services/i18n/i18n';
import { getDeviceUnitSystem } from '@/services/units/deviceUnitSystem';

const mmkvZustandStorage = {
  getItem: (name: string) => {
    const value = getItem<string>(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    setItem(name, value);
  },
  removeItem: (name: string) => {
    removeItem(name);
  },
};

export interface SettingsState {
  units: UnitSystem;
  language: LocaleCode;
  /** Client epoch ms of the last local change; 0 until the user changes something here. */
  updatedAt: number;
  setUnits: (units: UnitSystem) => void;
  setLanguage: (language: LocaleCode) => void;
  /** Adopts a remote document, `updatedAt` included, so both devices agree on its age. */
  applyRemoteSettings: (preferences: UserPreferences) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      units: getDeviceUnitSystem(),
      language: getDeviceLocale(),
      updatedAt: 0,
      setUnits: (units) => set({ units, updatedAt: Date.now() }),
      setLanguage: (language) => set({ language, updatedAt: Date.now() }),
      applyRemoteSettings: ({ units, language, updatedAt }) =>
        set({ units, language, updatedAt }),
    }),
    {
      name: '@fitness_tracker/settings',
      storage: createJSONStorage(() => mmkvZustandStorage),
    },
  ),
);
