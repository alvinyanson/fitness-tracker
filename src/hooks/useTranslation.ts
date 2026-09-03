import { useCallback, useMemo } from 'react';

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

  // Keeps i18n on the active locale before any t() call in this render.
  setLocale(language);

  // Keyed on language so consumers memoizing on `t` only re-run on a locale change.
  // The explicit locale is the same one setLocale applied above.
  const t = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      i18n.t(key, { locale: language, ...options }),
    [language],
  );

  return useMemo(
    () => ({ t, language, setLanguage }),
    [t, language, setLanguage],
  );
}
