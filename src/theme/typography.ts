import type { TextStyle } from 'react-native';

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  lineHeight: number;
  letterSpacing?: number;
}

export const type = {
  displayMetrics: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 48,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 48,
    letterSpacing: -0.96,
  },
  headlineLg: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 32,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 40,
    letterSpacing: -0.32,
  },
  headlineLgMobile: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 28,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 34,
  },
  headlineMd: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  labelCaps: {
    fontFamily: 'JetBrains Mono',
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.6,
  },
  labelSm: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 16,
  },
} as const satisfies Record<string, TypeStyle>;

export type TypeToken = keyof typeof type;
