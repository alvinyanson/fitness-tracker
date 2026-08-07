import { LocaleCode } from '@/interfaces/i18n';

export function formatDate(
  date: Date,
  locale: LocaleCode,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
