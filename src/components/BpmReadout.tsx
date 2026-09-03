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
import { colors, responsive, space, textStyle } from '@/theme';

export interface BpmReadoutProps {
  bpm: number | null;
  fontSize?: number;
  iconSize?: number;
}

export function BpmReadout({
  bpm,
  fontSize = responsive.bpmFontSize.phone,
  iconSize = responsive.bpmIconSize.phone,
}: BpmReadoutProps) {
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
            size={iconSize}
            color={bpm !== null ? colors.primaryContainer : colors.outline}
          />
        </Animated.View>
        <Text
          style={[
            styles.readoutText,
            // lineHeight tracks fontSize at the design's 72/64 ratio.
            { fontSize, lineHeight: Math.round(fontSize * (72 / 64)) },
          ]}
        >
          {displayValue}
        </Text>
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
    fontWeight: '700',
    letterSpacing: -1,
  },
  bpmUnit: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelCaps'),
    marginTop: space.unit,
  },
});
