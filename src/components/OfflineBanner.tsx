import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, textStyle } from '@/theme';

const BANNER_HEIGHT = space.unit * 9;
const BANNER_ANIMATION_MS = 300;

export interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  const title = t('network.offlineBannerTitle');

  // Stays mounted at zero height so the height/opacity transition has somewhere to run.
  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(visible ? BANNER_HEIGHT : 0, {
      duration: BANNER_ANIMATION_MS,
    }),
    opacity: withTiming(visible ? 1 : 0, { duration: BANNER_ANIMATION_MS }),
  }));

  return (
    <Animated.View
      style={[styles.banner, animatedStyle]}
      pointerEvents="none"
      accessible={visible}
      accessibilityRole="alert"
      accessibilityLiveRegion={visible ? 'assertive' : 'none'}
      accessibilityLabel={title}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
    >
      <Text style={styles.text} numberOfLines={1}>
        {title}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    borderRadius: radii.base,
    paddingHorizontal: space.unit * 3,
    marginBottom: space.stackGap,
  },
  text: {
    color: colors.onErrorContainer,
    ...textStyle('labelSm'),
  },
});
