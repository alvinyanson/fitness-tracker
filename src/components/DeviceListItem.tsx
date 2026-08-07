import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiscoveredDevice } from '@/interfaces/ble';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface DeviceListItemProps {
  device: DiscoveredDevice;
  disabled: boolean;
  onPress: (deviceId: string) => void;
}

export function DeviceListItem({
  device,
  disabled,
  onPress,
}: DeviceListItemProps): ReactNode {
  const { t } = useTranslation();

  const displayName = device.name ?? t('pairing.unknownDevice');
  const displayRssi =
    device.rssi !== null ? `${device.rssi} dBm` : t('pairing.rssiUnavailable');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        disabled && styles.rowDisabled,
        pressed && !disabled && styles.rowPressed,
      ]}
      onPress={() => onPress(device.id)}
      disabled={disabled}
      accessibilityRole="button"
    >
      <View style={styles.info}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.id}>{device.id}</Text>
      </View>
      <Text
        style={[styles.rssi, device.rssi === null && styles.rssiUnavailable]}
      >
        {displayRssi}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.md,
    padding: space.unit * 4,
    marginBottom: space.unit * 2,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowPressed: {
    opacity: 0.8,
  },
  info: {
    flex: 1,
    gap: space.unit,
  },
  name: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  id: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  rssi: {
    color: colors.primary,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
    marginLeft: space.unit * 2,
  },
  rssiUnavailable: {
    color: colors.onSurfaceVariant,
  },
});
