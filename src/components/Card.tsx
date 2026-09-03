import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { colors, radii, space } from '@/theme';

export interface CardProps extends ViewProps {
  children: ReactNode;
}

/** The shared card surface: background, radius, border, padding and stack gap. */
export function Card({ children, style, ...rest }: CardProps): ReactNode {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space.unit * 4,
    gap: space.unit * 2,
  },
});
