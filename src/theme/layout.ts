export const radii = {
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

export const space = {
  unit: 4,
  containerPadding: 20,
  stackGap: 16,
  gridGutter: 12,
  safeAreaBottom: 34,
} as const;
