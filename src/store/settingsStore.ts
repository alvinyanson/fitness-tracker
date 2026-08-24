import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getItem, setItem, removeItem } from '@/services/storage/mmkvStorage';
import { LocaleCode } from '@/interfaces/i18n';
import { UnitSystem } from '@/interfaces/units';
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
  setUnits: (units: UnitSystem) => void;
  setLanguage: (language: LocaleCode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      units: getDeviceUnitSystem(),
      language: getDeviceLocale(),
      setUnits: (units) => set({ units }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: '@fitness_tracker/settings',
      storage: createJSONStorage(() => mmkvZustandStorage),
    },
  ),
);
