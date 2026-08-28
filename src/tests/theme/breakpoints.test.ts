import {
  breakpoints,
  paneWidthStyle,
  resolveSizeClass,
  responsive,
  shouldUseTwoPane,
  TWO_PANE_MIN_WIDTH,
} from '@/theme';

describe('resolveSizeClass', () => {
  it('classifies below the tablet breakpoint as phone', () => {
    expect(resolveSizeClass(359)).toBe('phone');
    expect(resolveSizeClass(360)).toBe('phone');
    expect(resolveSizeClass(breakpoints.tablet - 1)).toBe('phone');
  });

  it('classifies the tablet breakpoint inclusively', () => {
    expect(resolveSizeClass(600)).toBe('tablet');
    expect(resolveSizeClass(839)).toBe('tablet');
  });

  it('classifies the large-tablet breakpoint inclusively', () => {
    expect(resolveSizeClass(840)).toBe('tabletLg');
    expect(resolveSizeClass(1280)).toBe('tabletLg');
  });

  it('falls back to phone for non-finite or negative input', () => {
    expect(resolveSizeClass(Number.NaN)).toBe('phone');
    expect(resolveSizeClass(Number.POSITIVE_INFINITY)).toBe('phone');
    expect(resolveSizeClass(-1)).toBe('phone');
  });
});

describe('shouldUseTwoPane', () => {
  it('never splits a phone, however wide the window', () => {
    expect(shouldUseTwoPane(1280, 'phone')).toBe(false);
  });

  it('requires the current width to reach the two-pane threshold', () => {
    expect(shouldUseTwoPane(TWO_PANE_MIN_WIDTH - 1, 'tablet')).toBe(false);
    expect(shouldUseTwoPane(TWO_PANE_MIN_WIDTH, 'tablet')).toBe(true);
    expect(shouldUseTwoPane(719, 'tabletLg')).toBe(false);
    expect(shouldUseTwoPane(720, 'tabletLg')).toBe(true);
  });

  it('returns false for non-finite width', () => {
    expect(shouldUseTwoPane(Number.NaN, 'tablet')).toBe(false);
  });
});

describe('responsive tokens', () => {
  it('marks phone content as full bleed with an explicit null', () => {
    expect(responsive.contentMaxWidth.phone).toBeNull();
    expect(responsive.masterPaneWidth.phone).toBeNull();
  });

  it('keeps the phone BPM readout at its existing 64/36 sizing', () => {
    expect(responsive.bpmFontSize.phone).toBe(64);
    expect(responsive.bpmIconSize.phone).toBe(36);
  });
});

describe('paneWidthStyle', () => {
  it('returns a width style for a real pane width', () => {
    expect(paneWidthStyle(320)).toEqual({ width: 320 });
    expect(paneWidthStyle(responsive.masterPaneWidth.tabletLg)).toEqual({
      width: 380,
    });
  });

  it('returns null when the size class has no pane width', () => {
    expect(paneWidthStyle(responsive.masterPaneWidth.phone)).toBeNull();
    expect(paneWidthStyle(Number.NaN)).toBeNull();
  });
});
