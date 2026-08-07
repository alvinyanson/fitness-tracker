import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BleGateStatus } from '@/interfaces/ble';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface BlePermissionGateViewProps {
  status: Exclude<BleGateStatus, 'ready'>;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function BlePermissionGateView({
  status,
  onRetry,
  onOpenSettings,
}: BlePermissionGateViewProps): ReactNode {
  const getContent = () => {
    switch (status) {
      case 'checking':
        return {
          title: 'Checking Permissions',
          description: 'Checking Bluetooth permissions and adapter status...',
          buttonText: 'Checking...',
          action: onRetry,
          disabled: true,
        };
      case 'permissionDenied':
        return {
          title: 'Bluetooth Permission Required',
          description:
            'Fitness Tracker needs Bluetooth permissions to scan for and connect to heart rate monitors.',
          buttonText: 'Retry',
          action: onRetry,
          disabled: false,
        };
      case 'permissionBlocked':
        return {
          title: 'Permission Permanently Denied',
          description:
            'Bluetooth permissions are blocked in system settings. Please enable Bluetooth permissions for Fitness Tracker in your device settings.',
          buttonText: 'Open Settings',
          action: onOpenSettings,
          disabled: false,
        };
      case 'bluetoothOff':
        return {
          title: 'Bluetooth is Turned Off',
          description:
            'Bluetooth is currently turned off on your device. Please turn on Bluetooth to connect your heart rate monitor.',
          buttonText: 'Retry',
          action: onRetry,
          disabled: false,
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.description}>{content.description}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            content.disabled && styles.buttonDisabled,
            pressed && !content.disabled && styles.buttonPressed,
          ]}
          onPress={content.action}
          disabled={content.disabled}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{content.buttonText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 6,
    alignItems: 'center',
    gap: space.stackGap,
  },
  title: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineMd.fontSize,
    fontWeight: typeStyles.headlineMd.fontWeight,
    lineHeight: typeStyles.headlineMd.lineHeight,
    textAlign: 'center',
  },
  description: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    lineHeight: typeStyles.bodyMd.lineHeight,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primaryContainer,
    paddingVertical: space.unit * 3,
    paddingHorizontal: space.unit * 6,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    marginTop: space.unit * 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.onPrimaryContainer,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
});
