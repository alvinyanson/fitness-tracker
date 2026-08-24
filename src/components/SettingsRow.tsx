import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
}

export function SettingsRow({
  icon,
  label,
  children,
}: SettingsRowProps): ReactNode {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.onSurfaceVariant} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
    padding: space.unit * 3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  label: {
    flex: 1,
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '500',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  control: {
    flexShrink: 0,
  },
});
