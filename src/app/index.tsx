import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, type as typeStyles } from '@/theme';
import { BlePermissionGateView } from '@/components/BlePermissionGateView';
import { DeviceListItem } from '@/components/DeviceListItem';
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
    scan,
    stopScan,
    connectToDevice,
    disconnect,
    unpair,
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
        return t('pairing.connecting');
      case 'connected':
        return t('pairing.connected');
      case 'disconnected':
        return t('pairing.disconnected');
      case 'error':
        return `${t('pairing.errorPrefix')}: ${connection.message}`;
    }
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

  return (
    <View style={styles.container}>
      {/* Status label */}
      <Text style={styles.statusText}>{getStatusText()}</Text>

      {/* Paired device card */}
      {pairedDevice && (
        <View style={styles.pairedCard}>
          <Text style={styles.pairedLabel}>
            {t('pairing.pairedDeviceLabel')}
          </Text>
          <Text style={styles.pairedName}>
            {pairedDevice.name ?? t('pairing.unknownDevice')}
          </Text>
          <Text style={styles.pairedId}>{pairedDevice.id}</Text>
          <View style={styles.pairedActions}>
            {isPairedDeviceConnected ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
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
                  styles.button,
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
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonDanger,
                pressed && styles.buttonPressed,
              ]}
              onPress={unpair}
              accessibilityRole="button"
            >
              <Text style={styles.buttonDangerText}>{t('pairing.unpair')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Scan / Stop Scan button */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonPrimary,
          styles.scanButton,
          (isConnecting || isConnected) && styles.buttonDisabled,
          pressed && !isConnecting && !isConnected && styles.buttonPressed,
        ]}
        onPress={isScanning ? stopScan : scan}
        disabled={isConnecting || isConnected}
        accessibilityRole="button"
      >
        <Text style={styles.buttonPrimaryText}>
          {isScanning ? t('pairing.stopScan') : t('pairing.scan')}
        </Text>
      </Pressable>

      {/* Device list */}
      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyList}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      {/* Garmin tip */}
      <Text style={styles.garminTip}>{t('pairing.garminTip')}</Text>

      {/* Navigation links */}
      <View style={styles.links}>
        <Link href="/workout" style={styles.link}>
          <Text style={styles.linkText}>{t('pairing.goToWorkout')}</Text>
        </Link>
        <Link href="/history" style={styles.link}>
          <Text style={styles.linkText}>{t('pairing.goToHistory')}</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space.containerPadding,
    paddingTop: space.unit * 12,
  },
  statusText: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineMd.fontSize,
    fontWeight: typeStyles.headlineMd.fontWeight,
    lineHeight: typeStyles.headlineMd.lineHeight,
    textAlign: 'center',
    marginBottom: space.stackGap,
  },
  pairedCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 5,
    marginBottom: space.stackGap,
    gap: space.unit * 2,
  },
  pairedLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
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
    marginTop: space.unit * 2,
  },
  button: {
    paddingVertical: space.unit * 3,
    paddingHorizontal: space.unit * 5,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primaryContainer,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  buttonDanger: {
    backgroundColor: colors.errorContainer,
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
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  buttonSecondaryText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  buttonDangerText: {
    color: colors.onErrorContainer,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  scanButton: {
    alignSelf: 'center',
    minWidth: 140,
    marginBottom: space.stackGap,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space.unit * 10,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    lineHeight: typeStyles.bodyMd.lineHeight,
    textAlign: 'center',
  },
  garminTip: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
    textAlign: 'center',
    marginTop: space.unit * 2,
    marginBottom: space.stackGap,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.stackGap,
    paddingBottom: space.safeAreaBottom,
  },
  link: {
    padding: space.unit * 3,
  },
  linkText: {
    color: colors.primary,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: typeStyles.bodyLg.fontWeight,
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
});
