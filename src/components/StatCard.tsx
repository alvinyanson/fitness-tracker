import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

export function StatCard({ label, value, unit }: StatCardProps): ReactNode {
  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 4,
    minHeight: 88,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  label: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.unit,
    marginTop: space.unit,
  },
  value: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLgMobile.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLgMobile.lineHeight,
  },
  unit: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
  },
});
