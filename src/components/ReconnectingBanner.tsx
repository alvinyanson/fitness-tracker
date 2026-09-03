import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, textStyle } from '@/theme';

export interface ReconnectingBannerProps {
  visible: boolean;
}

export function ReconnectingBanner({ visible }: ReconnectingBannerProps) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <View
      style={styles.banner}
      pointerEvents="none"
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={t('workout.reconnecting')}
    >
      <Text style={styles.text}>{t('workout.reconnecting')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: space.unit * 3,
    paddingVertical: space.unit * 2,
    borderRadius: radii.base,
    alignSelf: 'center',
    marginBottom: space.stackGap,
  },
  text: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
  },
});
