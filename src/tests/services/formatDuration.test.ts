import { formatDuration } from '@/services/formatDuration';

describe('formatDuration', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats 59 seconds as 00:59', () => {
    expect(formatDuration(59)).toBe('00:59');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatDuration(60)).toBe('01:00');
  });

  it('formats 3599 seconds as 59:59', () => {
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formats 3600 seconds as 1:00:00', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });
});
