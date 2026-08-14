import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, space, type as typeStyles } from '@/theme';

export interface BpmReadoutProps {
  bpm: number | null;
}

export function BpmReadout({ bpm }: BpmReadoutProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const prevBpmRef = useRef<number | null>(bpm);

  useEffect(() => {
    if (prevBpmRef.current !== bpm) {
      prevBpmRef.current = bpm;
      if (bpm !== null) {
        scale.value = withSequence(
          withTiming(1.15, { duration: 120 }),
          withTiming(1, { duration: 160 }),
        );
      }
    }
  }, [bpm, scale]);

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayValue = bpm !== null ? `${bpm}` : t('workout.noData');

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${displayValue} ${t('common.bpm')}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.readoutRow}>
        <Animated.View style={[styles.heartContainer, animatedHeartStyle]}>
          <Ionicons
            name="heart-outline"
            size={36}
            color={bpm !== null ? colors.primaryContainer : colors.outline}
          />
        </Animated.View>
        <Text style={styles.readoutText}>{displayValue}</Text>
      </View>
      <Text style={styles.bpmUnit}>{t('common.bpm')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.unit * 2,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  readoutText: {
    color: colors.onSurface,
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
    letterSpacing: -1,
  },
  bpmUnit: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    marginTop: space.unit,
  },
});
