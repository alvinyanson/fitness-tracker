import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, space, type as typeStyles } from '@/theme';

export interface HeaderBarProps {
  title: string;
  showSignalIcon?: boolean;
  deviceStatusBadge?: {
    connected: boolean;
    name: string;
  } | null;
  onProfilePress?: () => void;
}

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

export function HeaderBar({
  title,
  showSignalIcon = true,
  deviceStatusBadge,
  onProfilePress,
}: HeaderBarProps): ReactNode {
  const insets = useSafeInsets();
  const { t } = useTranslation();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      try {
        router.push('/settings' as any);
      } catch {
        // fallback
      }
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: 56 + insets.top,
        },
      ]}
    >
      {/* Content Row */}
      <View style={styles.headerContent}>
        {/* Left section: Signal icon + Title */}
        <View style={styles.leftSection}>
          {showSignalIcon && (
            <Feather
              name="radio"
              size={18}
              color={colors.surfaceTint}
              style={styles.signalIcon}
            />
          )}
          <Text style={styles.titleText} accessibilityRole="header">
            {title}
          </Text>
        </View>

        {/* Center section: Device status badge pill if provided */}
        {deviceStatusBadge && (
          <View
            style={styles.statusBadge}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`${deviceStatusBadge.name}, ${
              deviceStatusBadge.connected
                ? t('pairing.connected')
                : t('pairing.disconnected')
            }`}
          >
            <View
              style={[
                styles.statusDot,
                deviceStatusBadge.connected
                  ? styles.statusDotConnected
                  : styles.statusDotDisconnected,
              ]}
            />
            <Text style={styles.statusBadgeText} numberOfLines={1}>
              {deviceStatusBadge.name.toUpperCase()}
            </Text>
          </View>
        )}

        {/* Right section: Profile button */}
        <Pressable
          style={({ pressed }) => [
            styles.profileButton,
            pressed && styles.profileButtonPressed,
          ]}
          onPress={handleProfilePress}
          accessibilityRole="button"
          accessibilityLabel={t('common.profile')}
          accessibilityHint={t('common.profileHint')}
        >
          <Ionicons
            name="person-circle-outline"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
    backgroundColor: colors.surface,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.containerPadding,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 2,
  },
  signalIcon: {
    marginRight: 2,
  },
  titleText: {
    color: colors.onSurface,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: space.unit,
    paddingHorizontal: space.unit * 3,
    borderRadius: 9999,
    gap: space.unit * 2,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    maxWidth: 160,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotConnected: {
    backgroundColor: colors.primaryContainer,
  },
  statusDotDisconnected: {
    backgroundColor: colors.outline,
  },
  statusBadgeText: {
    color: colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  profileButton: {
    padding: space.unit,
    borderRadius: 9999,
  },
  profileButtonPressed: {
    opacity: 0.7,
  },
});
