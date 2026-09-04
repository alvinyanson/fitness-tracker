import { setLocale } from '@/services/i18n/i18n';
import { formatRelativeDate } from '@/utils/formatRelativeDate';

describe('formatRelativeDate', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('returns "Today" when date falls on the same calendar day as now', () => {
    const now = new Date(2023, 9, 24, 14, 30, 0); // Oct 24, 2023 14:30
    const date = new Date(2023, 9, 24, 8, 15, 0); // Oct 24, 2023 08:15

    expect(formatRelativeDate(date, now, 'en')).toBe('Today');
  });

  it('returns "Yesterday" when date falls on the previous calendar day', () => {
    const now = new Date(2023, 9, 24, 14, 30, 0); // Oct 24, 2023 14:30
    const date = new Date(2023, 9, 23, 20, 0, 0); // Oct 23, 2023 20:00

    expect(formatRelativeDate(date, now, 'en')).toBe('Yesterday');
  });

  it('falls back to medium date format when date is two or more days prior', () => {
    const now = new Date(2023, 9, 24, 14, 30, 0); // Oct 24, 2023
    const date = new Date(2023, 9, 22, 10, 0, 0); // Oct 22, 2023

    const result = formatRelativeDate(date, now, 'en');
    expect(result).toMatch(/Oct 22, 2023/);
  });

  it('correctly handles calendar day boundary across midnight', () => {
    const now = new Date(2023, 9, 24, 0, 1, 0); // Oct 24, 2023 00:01
    const date = new Date(2023, 9, 23, 23, 59, 0); // Oct 23, 2023 23:59 (2 minutes earlier)

    expect(formatRelativeDate(date, now, 'en')).toBe('Yesterday');
  });

  it('returns Japanese translations when locale is ja', () => {
    setLocale('ja');
    const now = new Date(2023, 9, 24, 14, 30, 0);
    const todayDate = new Date(2023, 9, 24, 8, 15, 0);
    const yesterdayDate = new Date(2023, 9, 23, 20, 0, 0);

    expect(formatRelativeDate(todayDate, now, 'ja')).toBe('今日');
    expect(formatRelativeDate(yesterdayDate, now, 'ja')).toBe('昨日');
  });
});
