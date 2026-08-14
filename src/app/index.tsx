import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, type as typeStyles } from '@/theme';
import { BlePermissionGateView } from '@/components/BlePermissionGateView';
import { BottomNavBar } from '@/components/BottomNavBar';
import { DeviceListItem } from '@/components/DeviceListItem';
import { HeaderBar } from '@/components/HeaderBar';
import { useBlePermissionGate } from '@/hooks/useBlePermissionGate';
import { useDevicePairing } from '@/hooks/useDevicePairing';
import type { DiscoveredDevice } from '@/interfaces/ble';

export default function PairingScreen() {
  const { status, retry, openAppSettings } = useBlePermissionGate();

  if (status !== 'ready') {
    return (
      <BlePermissionGateView
        status={status}
        onRetry={retry}
        onOpenSettings={openAppSettings}
      />
    );
  }

  return <PairingContent />;
}

function PairingContent() {
  const { t } = useTranslation();
  const {
    connection,
    devices,
    pairedDevice,
    isScanning,
    isAutoReconnecting,
    scan,
    stopScan,
    connectToDevice,
    disconnect,
    unpair,
    cancelReconnect,
  } = useDevicePairing();

  const isConnecting = connection.state === 'connecting';
  const isConnected = connection.state === 'connected';

  const getStatusText = (): string => {
    switch (connection.state) {
      case 'idle':
        return t('pairing.title');
      case 'scanning':
        return t('pairing.scanning');
      case 'connecting':
        return isAutoReconnecting
          ? t('pairing.reconnecting')
          : t('pairing.connecting');
      case 'connected':
        return t('pairing.connected');
      case 'disconnected':
        return t('pairing.disconnected');
      case 'error':
        return `${t('pairing.errorPrefix')}: ${connection.message}`;
    }
  };

  const getHeroStatusLabel = (): string => {
    if (isScanning) return t('pairing.heroScanning');
    if (isAutoReconnecting) return t('pairing.heroReconnecting');
    if (isConnecting) return t('pairing.heroConnecting');
    if (isConnected) return t('pairing.heroConnected');
    return t('pairing.heroDiscoverability');
  };

  const renderDeviceItem = ({ item }: { item: DiscoveredDevice }) => (
    <DeviceListItem
      device={item}
      disabled={isConnecting || isConnected}
      onPress={connectToDevice}
    />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {isScanning ? t('pairing.emptyScanning') : t('pairing.emptyIdle')}
      </Text>
    </View>
  );

  const isPairedDeviceConnected =
    isConnected &&
    pairedDevice !== null &&
    connection.state === 'connected' &&
    connection.device.id === pairedDevice.id;

  // Determine icon for paired device
  const pairedNameLower = (pairedDevice?.name || '').toLowerCase();
  let pairedIconName: 'heart-pulse' | 'watch' | 'dumbbell' = 'heart-pulse';
  if (
    pairedNameLower.includes('watch') ||
    pairedNameLower.includes('garmin') ||
    pairedNameLower.includes('forerunner')
  ) {
    pairedIconName = 'watch';
  } else if (
    pairedNameLower.includes('treadmill') ||
    pairedNameLower.includes('trainer') ||
    pairedNameLower.includes('bike')
  ) {
    pairedIconName = 'dumbbell';
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <HeaderBar title={t('pairing.headerTitle')} showSignalIcon={true} />

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.heroSection}>
            {/* Status indicator badge / state text */}
            <Text style={styles.statusText}>{getStatusText()}</Text>

            {/* Glowing Central Pairing Avatar Circle */}
            <View style={styles.circleOuterGlow}>
              <View style={styles.circleAvatar}>
                <Feather
                  name={isScanning ? 'radio' : 'bluetooth'}
                  size={36}
                  color={
                    isConnected
                      ? colors.primaryContainer
                      : isScanning
                        ? colors.surfaceTint
                        : colors.onSurface
                  }
                />
              </View>
            </View>

            {/* Hero Subtitle */}
            <Text style={styles.heroStatusCaps}>{getHeroStatusLabel()}</Text>
            <Text style={styles.heroDescription}>
              {t('pairing.heroDescription')}
            </Text>

            {/* Cancel button during auto-reconnect */}
            {isAutoReconnecting && (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonSecondary,
                  styles.cancelReconnectButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={cancelReconnect}
                accessibilityRole="button"
              >
                <Text style={styles.buttonSecondaryText}>
                  {t('pairing.cancel')}
                </Text>
              </Pressable>
            )}

            {/* Paired Device Card */}
            {pairedDevice && (
              <View style={styles.pairedCard}>
                {/* Header row with status indicator */}
                <View style={styles.pairedHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      isPairedDeviceConnected
                        ? styles.statusDotConnected
                        : styles.statusDotDisconnected,
                    ]}
                  />
                  <Text style={styles.pairedLabel}>
                    {t('pairing.pairedDeviceLabel')}
                  </Text>
                </View>

                {/* Device Info with dynamic category avatar icon */}
                <View style={styles.pairedDeviceRow}>
                  <View style={styles.pairedIconAvatar}>
                    {pairedIconName === 'heart-pulse' ? (
                      <MaterialCommunityIcons
                        name="heart-pulse"
                        size={22}
                        color={colors.primaryContainer}
                      />
                    ) : pairedIconName === 'watch' ? (
                      <Ionicons
                        name="watch-outline"
                        size={22}
                        color={colors.primaryContainer}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="dumbbell"
                        size={22}
                        color={colors.primaryContainer}
                      />
                    )}
                  </View>
                  <View style={styles.pairedMetaInfo}>
                    <Text style={styles.pairedName} numberOfLines={1}>
                      {pairedDevice.name ?? t('pairing.unknownDevice')}
                    </Text>
                    <Text style={styles.pairedId} numberOfLines={1}>
                      {pairedDevice.id}
                    </Text>
                  </View>
                </View>

                {/* Compact, refined action buttons */}
                <View style={styles.pairedActions}>
                  {isPairedDeviceConnected ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.compactButton,
                        styles.buttonSecondary,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={disconnect}
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonSecondaryText}>
                        {t('pairing.disconnect')}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.compactButton,
                        styles.buttonPrimary,
                        (isConnecting || isConnected) && styles.buttonDisabled,
                        pressed &&
                          !isConnecting &&
                          !isConnected &&
                          styles.buttonPressed,
                      ]}
                      onPress={() => connectToDevice(pairedDevice.id)}
                      disabled={isConnecting || isConnected}
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonPrimaryText}>
                        {t('pairing.connect')}
                      </Text>
                    </Pressable>
                  )}

                  {/* Refined Unpair Button (Soft text style instead of heavy solid red block) */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.compactButton,
                      styles.buttonGhostDanger,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={unpair}
                    accessibilityRole="button"
                  >
                    <Text style={styles.buttonGhostDangerText}>
                      {t('pairing.unpair')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Section Title */}
            {devices.length > 0 && (
              <Text style={styles.sectionTitle}>
                {t('pairing.availableDevices')}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerSection}>
            {/* Scan / Stop Scan button pill */}
            <Pressable
              style={({ pressed }) => [
                styles.scanPillButton,
                (isConnecting || isConnected) && styles.buttonDisabled,
                pressed &&
                  !isConnecting &&
                  !isConnected &&
                  styles.buttonPressed,
              ]}
              onPress={isScanning ? stopScan : scan}
              disabled={isConnecting || isConnected}
              accessibilityRole="button"
            >
              <Text style={styles.scanPillButtonText}>
                {isScanning ? t('pairing.stopScan') : t('pairing.scan')}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={renderEmptyList}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      {/* Bottom Navigation Bar */}
      <BottomNavBar currentRoute="pairing" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: space.containerPadding,
    paddingTop: space.unit * 4,
    paddingBottom: space.unit * 4,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: space.unit * 4,
  },
  statusText: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineMd.fontSize,
    fontWeight: typeStyles.headlineMd.fontWeight,
    lineHeight: typeStyles.headlineMd.lineHeight,
    textAlign: 'center',
    marginBottom: space.unit * 4,
  },
  circleOuterGlow: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(0, 219, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 219, 233, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.unit * 4,
  },
  circleAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatusCaps: {
    color: colors.onSurface,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    marginBottom: space.unit,
    textAlign: 'center',
  },
  heroDescription: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    lineHeight: typeStyles.bodyMd.lineHeight,
    textAlign: 'center',
    marginBottom: space.stackGap,
  },
  cancelReconnectButton: {
    marginBottom: space.stackGap,
  },
  pairedCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 4,
    marginBottom: space.stackGap,
    gap: space.unit * 3,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  pairedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotConnected: {
    backgroundColor: colors.primaryContainer,
  },
  statusDotDisconnected: {
    backgroundColor: colors.outline,
  },
  pairedLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  pairedDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
  },
  pairedIconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairedMetaInfo: {
    flex: 1,
    gap: 2,
  },
  pairedName: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
  pairedId: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  pairedActions: {
    flexDirection: 'row',
    gap: space.unit * 2,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 3,
  },
  button: {
    paddingVertical: space.unit * 3,
    paddingHorizontal: space.unit * 4,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  compactButton: {
    height: 38,
    paddingHorizontal: space.unit * 4,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: colors.primaryContainer,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  buttonGhostDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.3)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonPrimaryText: {
    color: colors.onPrimaryContainer,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
  },
  buttonGhostDangerText: {
    color: colors.error,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: space.unit * 4,
  },
  scanPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: space.unit * 4,
  },
  scanPillButtonText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: space.unit * 6,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    textAlign: 'center',
  },
});
