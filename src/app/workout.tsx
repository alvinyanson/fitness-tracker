import { useCallback, useEffect } from 'react';
import { Link, router, useFocusEffect } from 'expo-router';
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BpmReadout } from '@/components/BpmReadout';
import { ReconnectingBanner } from '@/components/ReconnectingBanner';
import { useTranslation } from '@/hooks/useTranslation';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { formatDuration } from '@/services/formatDuration';
import { colors, radii, space, type as typeStyles } from '@/theme';

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const {
    status,
    reconnecting,
    elapsedMs,
    currentBpm,
    rollingAverageBpm,
    start,
    pause,
    resume,
    stop,
  } = useWorkoutSession();

  // Hardware back confirmation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (status === 'idle' || status === 'stopped') {
          return false;
        }

        Alert.alert(t('workout.discardTitle'), t('workout.discardMessage'), [
          { text: t('workout.discardCancel'), style: 'cancel' },
          {
            text: t('workout.discardConfirm'),
            style: 'destructive',
            onPress: stop,
          },
        ]);
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [status, stop, t]),
  );

  // Stop -> summary navigation effect
  useEffect(() => {
    if (status === 'stopped') {
      router.replace('/summary/current');
    }
  }, [status]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const formattedDuration = formatDuration(elapsedSeconds);

  const rollingAvgText =
    rollingAverageBpm !== null ? `${rollingAverageBpm}` : t('workout.noData');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('workout.title')}</Text>

      <ReconnectingBanner visible={reconnecting} />

      <View style={styles.metricsContainer}>
        <Text style={styles.timerText}>{formattedDuration}</Text>
        <BpmReadout bpm={currentBpm} />
        <Text style={styles.rollingAvgText}>
          {t('workout.rollingAvgLabel')}: {rollingAvgText}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        {(status === 'idle' || status === 'stopped') && (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.buttonPressed,
            ]}
            onPress={start}
            accessibilityRole="button"
          >
            <Text style={styles.buttonPrimaryText}>{t('workout.start')}</Text>
          </Pressable>
        )}

        {status === 'active' && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.buttonPressed,
              ]}
              onPress={pause}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText}>
                {t('workout.pause')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonDanger,
                pressed && styles.buttonPressed,
              ]}
              onPress={stop}
              accessibilityRole="button"
            >
              <Text style={styles.buttonDangerText}>{t('workout.stop')}</Text>
            </Pressable>
          </>
        )}

        {status === 'paused' && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                pressed && styles.buttonPressed,
              ]}
              onPress={resume}
              accessibilityRole="button"
            >
              <Text style={styles.buttonPrimaryText}>
                {t('workout.resume')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonDanger,
                pressed && styles.buttonPressed,
              ]}
              onPress={stop}
              accessibilityRole="button"
            >
              <Text style={styles.buttonDangerText}>{t('workout.stop')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {status === 'idle' && (
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('workout.backToPairing')}</Text>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  title: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: typeStyles.headlineLg.fontWeight,
    lineHeight: typeStyles.headlineLg.lineHeight,
    marginBottom: space.stackGap,
  },
  metricsContainer: {
    alignItems: 'center',
    marginVertical: space.unit * 6,
    gap: space.unit * 3,
  },
  timerText: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: typeStyles.headlineLg.fontWeight,
    lineHeight: typeStyles.headlineLg.lineHeight,
  },
  rollingAvgText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: typeStyles.bodyMd.fontWeight,
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: space.unit * 4,
    marginTop: space.unit * 6,
    marginBottom: space.stackGap,
  },
  button: {
    paddingVertical: space.unit * 3,
    paddingHorizontal: space.unit * 6,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
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
  link: {
    padding: space.unit * 3,
    marginTop: space.stackGap,
  },
  linkText: {
    color: colors.primary,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: typeStyles.bodyLg.fontWeight,
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
});
