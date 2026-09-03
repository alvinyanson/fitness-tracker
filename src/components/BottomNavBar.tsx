import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, router, usePathname } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, space, textStyle } from '@/theme';

export interface BottomNavBarProps {
  currentRoute?: 'pairing' | 'workout' | 'history' | 'settings';
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
    (pathname.includes('settings')
      ? 'settings'
      : pathname.includes('workout')
        ? 'workout'
        : pathname.includes('history') || pathname.includes('summary')
          ? 'history'
          : 'pairing');

  const navigateTo = (path: Href) => {
    router.navigate(path);
  };

  return (
    <View
      testID="bottom-nav-bar"
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, space.unit * 2),
          paddingLeft: insets.left,
          paddingRight: insets.right,
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
    borderRadius: 50,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    // Always painted, never a layout-only view: toggling these off entirely lets
    // the New Architecture flatten the wrapper mid-render and drop the icon.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrapperActive: {
    backgroundColor: colors.primaryContainerFill,
    borderColor: colors.primaryContainerOutline,
  },
  tabLabel: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
  },
  tabLabelActive: {
    color: colors.onSurface,
    fontWeight: '600',
  },
});
