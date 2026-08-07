import { LocaleCode } from '@/interfaces/i18n';

export function formatNumber(
  value: number,
  locale: LocaleCode,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
