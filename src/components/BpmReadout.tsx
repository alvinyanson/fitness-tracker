import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, type as typeStyles } from '@/theme';

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
          withTiming(1.08, { duration: 100 }),
          withTiming(1, { duration: 150 }),
        );
      }
    }
  }, [bpm, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayValue = bpm !== null ? `${bpm}` : t('workout.noData');

  return (
    <Animated.View style={animatedStyle}>
      <Text style={styles.readoutText}>{displayValue}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  readoutText: {
    color: colors.onSurface,
    fontSize: typeStyles.displayMetrics.fontSize,
    fontWeight: typeStyles.displayMetrics.fontWeight,
    lineHeight: typeStyles.displayMetrics.lineHeight,
    letterSpacing: typeStyles.displayMetrics.letterSpacing,
  },
});
