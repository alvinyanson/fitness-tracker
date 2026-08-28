// Android sw-qualifier convention: 600dp ≈ 7" tablet, 840dp ≈ 10" tablet.
export const breakpoints = { phone: 0, tablet: 600, tabletLg: 840 } as const;

export type SizeClass = 'phone' | 'tablet' | 'tabletLg';
export type Orientation = 'portrait' | 'landscape';

/** Minimum *current* width before a master/detail split is worth showing. */
export const TWO_PANE_MIN_WIDTH = 720;

/** Per-size-class layout metrics. No screen hardcodes these numbers. */
export const responsive = {
  /** `null` means full bleed — an explicit absence, not a sentinel number. */
  contentMaxWidth: { phone: null, tablet: 640, tabletLg: 760 },
  containerPadding: { phone: 20, tablet: 32, tabletLg: 40 },
  statColumns: { phone: 2, tablet: 4, tabletLg: 4 },
  bpmFontSize: { phone: 64, tablet: 88, tabletLg: 96 },
  bpmIconSize: { phone: 36, tablet: 48, tabletLg: 52 },
  masterPaneWidth: { phone: null, tablet: 320, tabletLg: 380 },
} as const;

/** Size class from the smaller window dimension (Android smallestScreenWidthDp). */
export function resolveSizeClass(smallestWidth: number): SizeClass {
  if (!Number.isFinite(smallestWidth) || smallestWidth < 0) {
    return 'phone';
  }
  if (smallestWidth >= breakpoints.tabletLg) {
    return 'tabletLg';
  }
  if (smallestWidth >= breakpoints.tablet) {
    return 'tablet';
  }
  return 'phone';
}

/** Two panes require a non-phone class AND enough current width. */
export function shouldUseTwoPane(width: number, sizeClass: SizeClass): boolean {
  if (!Number.isFinite(width)) {
    return false;
  }
  return sizeClass !== 'phone' && width >= TWO_PANE_MIN_WIDTH;
}

/**
 * Fixed-width style for the master pane, or `null` on a size class that has no
 * pane width — so a screen never needs a fallback literal of its own.
 */
export function paneWidthStyle(width: number | null): { width: number } | null {
  return width !== null && Number.isFinite(width) ? { width } : null;
}
