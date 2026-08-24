import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  accessibilityHint?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>): ReactNode {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, selected && styles.segmentActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.accessibilityHint}
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.unit / 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  segment: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.unit * 3,
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: colors.primaryContainer,
  },
  segmentText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  segmentTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
});
