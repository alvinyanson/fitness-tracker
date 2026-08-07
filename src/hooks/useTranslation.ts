import { useSettingsStore } from '@/store/settingsStore';
import { i18n, setLocale } from '@/services/i18n/i18n';
import { LocaleCode } from '@/interfaces/i18n';

export function useTranslation(): {
  t: (key: string, options?: Record<string, unknown>) => string;
  language: LocaleCode;
  setLanguage: (language: LocaleCode) => void;
} {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  setLocale(language);

  return {
    t: (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
    language,
    setLanguage,
  };
}
