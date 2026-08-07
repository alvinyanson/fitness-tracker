import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import {
  DEFAULT_LOCALE,
  LocaleCode,
  SUPPORTED_LOCALES,
  TranslationTree,
} from '@/interfaces/i18n';
import en from './translations/en.json';
import ja from './translations/ja.json';

const translations: Record<LocaleCode, TranslationTree> = {
  en,
  ja,
};

export const i18n = new I18n(translations);

i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;

export function setLocale(locale: LocaleCode): void {
  i18n.locale = locale;
}

export function getDeviceLocale(): LocaleCode {
  const locales = getLocales();
  const rawLang = locales[0]?.languageCode;
  const langCode = rawLang ? rawLang.split('-')[0] : undefined;
  if (langCode && (SUPPORTED_LOCALES as readonly string[]).includes(langCode)) {
    return langCode as LocaleCode;
  }
  return DEFAULT_LOCALE;
}
