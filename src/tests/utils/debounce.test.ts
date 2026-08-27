import { debounce } from '@/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires on the trailing edge only', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid calls into one, with the last arguments', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    jest.advanceTimersByTime(50);
    debounced('b');
    jest.advanceTimersByTime(50);
    debounced('c');
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('drops a pending call on cancel', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });

  it('stays usable after a cancel', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    debounced();
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
