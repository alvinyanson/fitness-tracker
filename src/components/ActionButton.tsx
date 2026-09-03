import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, space, textStyle } from '@/theme';

export type ActionButtonVariant = 'primary' | 'secondary';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  /** Reported through `accessibilityState.busy`; does not render anything itself. */
  busy?: boolean;
  /** Leading content — an icon, or a spinner while a provider call is in flight. */
  icon?: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  labelNumberOfLines?: number;
}

/** The shared button frame: variant colours, 44dp minimum target, pressed/disabled states. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
  labelNumberOfLines,
}: ActionButtonProps): ReactNode {
  const isPrimary = variant === 'primary';
  // Only report a state the caller actually tracks.
  const accessibilityState =
    disabled === undefined && busy === undefined
      ? undefined
      : { disabled: disabled === true, busy: busy === true };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        style,
        disabled === true && styles.disabled,
        pressed && disabled !== true && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          labelStyle,
        ]}
        numberOfLines={labelNumberOfLines}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.unit * 1.5,
    borderRadius: radii.md,
    paddingVertical: space.unit * 2.5,
    paddingHorizontal: space.unit * 4,
    minHeight: 44,
  },
  primary: {
    backgroundColor: colors.primaryContainer,
  },
  secondary: {
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...textStyle('bodyMd'),
    fontWeight: '600',
  },
  primaryLabel: {
    color: colors.onPrimaryContainer,
  },
  secondaryLabel: {
    color: colors.onSurface,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
