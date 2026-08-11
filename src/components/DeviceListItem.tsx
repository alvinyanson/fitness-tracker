import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

  // Determine icon based on device name
  const nameLower = (displayName || '').toLowerCase();
  let iconName: 'heart-pulse' | 'watch' | 'dumbbell' = 'heart-pulse';
  let subtitle = 'BLE Tracker';

  if (
    nameLower.includes('watch') ||
    nameLower.includes('garmin') ||
    nameLower.includes('forerunner')
  ) {
    iconName = 'watch';
    subtitle = 'Sports Watch';
  } else if (
    nameLower.includes('treadmill') ||
    nameLower.includes('trainer') ||
    nameLower.includes('bike')
  ) {
    iconName = 'dumbbell';
    subtitle = 'Smart Fitness Device';
  } else if (nameLower.includes('strap') || nameLower.includes('sensor')) {
    iconName = 'heart-pulse';
    subtitle = 'Heart Rate Sensor';
  }

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
      accessibilityLabel={displayName}
    >
      {/* Device Icon Avatar */}
      <View style={styles.iconAvatar}>
        {iconName === 'heart-pulse' ? (
          <MaterialCommunityIcons
            name="heart-pulse"
            size={22}
            color={colors.surfaceTint}
          />
        ) : iconName === 'watch' ? (
          <Ionicons name="watch-outline" size={22} color={colors.surfaceTint} />
        ) : (
          <MaterialCommunityIcons
            name="dumbbell"
            size={22}
            color={colors.surfaceTint}
          />
        )}
      </View>

      {/* Info Container */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {subtitle !== displayName && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        <Text style={styles.id} numberOfLines={1}>
          {device.id}
        </Text>
      </View>

      {/* Signal Strength */}
      <View style={styles.signalContainer}>
        <Ionicons
          name="cellular-outline"
          size={18}
          color={
            device.rssi !== null ? colors.primaryContainer : colors.outline
          }
        />
        <Text
          style={[styles.rssi, device.rssi === null && styles.rssiUnavailable]}
        >
          {displayRssi}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 4,
    marginBottom: space.unit * 3,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowPressed: {
    opacity: 0.8,
    backgroundColor: colors.surfaceContainerHigh,
  },
  iconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.unit * 3,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
  subtitle: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  id: {
    color: colors.outline,
    fontSize: 10,
    fontWeight: '400',
  },
  signalContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    marginLeft: space.unit * 2,
  },
  rssi: {
    color: colors.primaryContainer,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: '500',
  },
  rssiUnavailable: {
    color: colors.outline,
  },
});
