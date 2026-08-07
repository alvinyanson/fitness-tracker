import { formatDate } from '@/utils/formatDate';

describe('formatDate', () => {
  const testDate = new Date(2026, 7, 7); // August 7, 2026

  it('formats date for en locale', () => {
    const formatted = formatDate(testDate, 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(formatted).toContain('August');
    expect(formatted).toContain('2026');
  });

  it('formats date for ja locale', () => {
    const formatted = formatDate(testDate, 'ja', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(formatted).toContain('2026');
    expect(formatted).toContain('8月');
    expect(formatted).toContain('7日');
  });
});
