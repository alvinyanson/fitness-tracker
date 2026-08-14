import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, space, type as typeStyles } from '@/theme';

export interface BottomNavBarProps {
  currentRoute?: 'pairing' | 'workout' | 'history';
}

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

export function BottomNavBar({ currentRoute }: BottomNavBarProps): ReactNode {
  const insets = useSafeInsets();
  let pathname = '';
  try {
    if (typeof usePathname === 'function') {
      pathname = usePathname() || '';
    }
  } catch {
    pathname = '';
  }

  const { t } = useTranslation();

  const activeRoute =
    currentRoute ??
    (pathname.includes('workout')
      ? 'workout'
      : pathname.includes('history') || pathname.includes('summary')
        ? 'history'
        : 'pairing');

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, space.unit * 2),
          height: 64 + insets.bottom,
        },
      ]}
    >
      {/* Pairing Tab */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigateTo('/')}
        accessibilityRole="tab"
        accessibilityLabel={t('pairing.title')}
        accessibilityHint={t('pairing.tabHint')}
        accessibilityState={{ selected: activeRoute === 'pairing' }}
      >
        <View
          style={[
            styles.iconWrapper,
            activeRoute === 'pairing' && styles.iconWrapperActive,
          ]}
        >
          <Feather
            name="bluetooth"
            size={20}
            color={
              activeRoute === 'pairing'
                ? colors.primaryContainer
                : colors.onSurfaceVariant
            }
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeRoute === 'pairing' && styles.tabLabelActive,
          ]}
        >
          {`${t('pairing.title')}\u200B`}
        </Text>
      </Pressable>

      {/* Workout Tab */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigateTo('/workout')}
        accessibilityRole="tab"
        accessibilityLabel={t('workout.title')}
        accessibilityHint={t('workout.tabHint')}
        accessibilityState={{ selected: activeRoute === 'workout' }}
      >
        <View
          style={[
            styles.iconWrapper,
            activeRoute === 'workout' && styles.iconWrapperActive,
          ]}
        >
          <MaterialCommunityIcons
            name="dumbbell"
            size={22}
            color={
              activeRoute === 'workout'
                ? colors.primaryContainer
                : colors.onSurfaceVariant
            }
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeRoute === 'workout' && styles.tabLabelActive,
          ]}
        >
          {`${t('workout.title')}\u200B`}
        </Text>
      </Pressable>

      {/* History Tab */}
      <Pressable
        style={styles.tabItem}
        onPress={() => navigateTo('/history')}
        accessibilityRole="tab"
        accessibilityLabel={t('history.title')}
        accessibilityHint={t('history.tabHint')}
        accessibilityState={{ selected: activeRoute === 'history' }}
      >
        <View
          style={[
            styles.iconWrapper,
            activeRoute === 'history' && styles.iconWrapperActive,
          ]}
        >
          <MaterialCommunityIcons
            name="history"
            size={22}
            color={
              activeRoute === 'history'
                ? colors.primaryContainer
                : colors.onSurfaceVariant
            }
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeRoute === 'history' && styles.tabLabelActive,
          ]}
        >
          {`${t('history.title')}\u200B`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHigh,
    paddingTop: space.unit * 2,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  tabLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  tabLabelActive: {
    color: colors.onSurface,
    fontWeight: '600',
  },
});
