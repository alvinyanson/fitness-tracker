import { formatNumber } from '@/utils/formatNumber';

describe('formatNumber', () => {
  const testNumber = 1234567.89;

  it('formats number for en locale', () => {
    const formatted = formatNumber(testNumber, 'en');
    expect(formatted).toBe('1,234,567.89');
  });

  it('formats number for ja locale', () => {
    const formatted = formatNumber(testNumber, 'ja');
    expect(formatted).toBe('1,234,567.89');
  });
});
