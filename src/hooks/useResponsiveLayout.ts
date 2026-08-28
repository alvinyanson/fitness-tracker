import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import type { Orientation, SizeClass } from '@/theme';
import { resolveSizeClass, responsive, shouldUseTwoPane } from '@/theme';

export interface ResponsiveLayout {
  width: number;
  height: number;
  sizeClass: SizeClass;
  orientation: Orientation;
  /** `sizeClass !== 'phone'`. */
  isTablet: boolean;
  isTwoPane: boolean;
  contentMaxWidth: number | null;
  containerPadding: number;
  statColumns: number;
  bpmFontSize: number;
  bpmIconSize: number;
  masterPaneWidth: number | null;
}

/**
 * The only `useWindowDimensions` call site in the codebase — every screen reads
 * layout through this so no component compares raw widths itself.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    // Smallest dimension, matching Android's smallestScreenWidthDp: it keeps the
    // class stable across rotation and keeps a landscape phone a phone.
    const sizeClass = resolveSizeClass(Math.min(width, height));

    return {
      width,
      height,
      sizeClass,
      orientation: width > height ? 'landscape' : 'portrait',
      isTablet: sizeClass !== 'phone',
      isTwoPane: shouldUseTwoPane(width, sizeClass),
      contentMaxWidth: responsive.contentMaxWidth[sizeClass],
      containerPadding: responsive.containerPadding[sizeClass],
      statColumns: responsive.statColumns[sizeClass],
      bpmFontSize: responsive.bpmFontSize[sizeClass],
      bpmIconSize: responsive.bpmIconSize[sizeClass],
      masterPaneWidth: responsive.masterPaneWidth[sizeClass],
    };
  }, [width, height]);
}
