import { LocaleCode } from '@/interfaces/i18n';
import { i18n } from '@/services/i18n/i18n';
import { formatDate } from '@/utils/formatDate';

export type RelativeDateLabels =
  { today: string; yesterday: string } | ((key: string) => string);

export function formatRelativeDate(
  date: Date,
  now: Date,
  locale: LocaleCode,
  labelsOrT?: RelativeDateLabels,
): string {
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getLabel = (key: 'today' | 'yesterday'): string => {
    if (typeof labelsOrT === 'function') {
      return labelsOrT(`history.${key}`);
    }
    if (labelsOrT && typeof labelsOrT === 'object') {
      return labelsOrT[key];
    }
    return i18n.t(`history.${key}`, { locale });
  };

  if (isSameDay(date, now)) {
    return getLabel('today');
  }

  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (isSameDay(date, yesterday)) {
    return getLabel('yesterday');
  }

  return formatDate(date, locale, { dateStyle: 'medium' });
}
