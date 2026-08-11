import { useCallback, useEffect, useMemo } from 'react';
import { Link, router, useFocusEffect } from 'expo-router';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BpmReadout } from '@/components/BpmReadout';
import { BottomNavBar } from '@/components/BottomNavBar';
import { HeaderBar } from '@/components/HeaderBar';
import { HrZoneBar } from '@/components/HrZoneBar';
import { ReconnectingBanner } from '@/components/ReconnectingBanner';
import { StatCard } from '@/components/StatCard';
import { useDevicePairing } from '@/hooks/useDevicePairing';
import { useTranslation } from '@/hooks/useTranslation';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { formatDuration } from '@/services/formatDuration';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { colors, radii, space, type as typeStyles } from '@/theme';

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { pairedDevice, connection } = useDevicePairing();
  const {
    status,
    reconnecting,
    elapsedMs,
    currentBpm,
    rollingAverageBpm,
    lastCompletedSessionId,
    start,
    pause,
    resume,
    stop,
  } = useWorkoutSession();

  // Ingest samples from session store for stats calculation
  const samples = useWorkoutSessionStore((state) => state.samples);

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
    if (status === 'stopped' && lastCompletedSessionId) {
      router.replace(`/summary/${lastCompletedSessionId}`);
    }
  }, [status, lastCompletedSessionId]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const formattedDuration = formatDuration(elapsedSeconds);

  // Calculate session statistics (Avg, Max, Calories)
  const { avgBpmDisplay, maxBpmDisplay, caloriesDisplay } = useMemo(() => {
    if (samples.length === 0) {
      return {
        avgBpmDisplay: '—',
        maxBpmDisplay: '—',
        caloriesDisplay: '0',
      };
    }

    const sum = samples.reduce((acc, s) => acc + s.bpm, 0);
    const avg = Math.round(sum / samples.length);
    const max = Math.max(...samples.map((s) => s.bpm));

    // Simple MET/HR calorie estimate (Assume standard 70kg user weight)
    const minutes = elapsedSeconds / 60;
    let calories = 0;
    if (minutes > 0) {
      if (avg > 0) {
        // HR-adjusted estimation formula
        const calPerMin = (avg * 0.2017 + 70 * 0.1988 - 55.0969) / 4.184;
        calories = Math.max(0, Math.round(minutes * Math.max(0.5, calPerMin)));
      } else {
        // Pure MET estimation formula (MET = 6.0)
        calories = Math.round(6.0 * 70 * (minutes / 60));
      }
    }

    return {
      avgBpmDisplay: `${avg}`,
      maxBpmDisplay: `${max}`,
      caloriesDisplay: `${calories}`,
    };
  }, [samples, elapsedSeconds]);

  const rollingAvgText =
    rollingAverageBpm !== null ? `${rollingAverageBpm}` : t('workout.noData');

  const deviceBadge = pairedDevice
    ? {
        connected: connection.state === 'connected',
        name: pairedDevice.name ?? 'TRACKER',
      }
    : connection.state === 'connected'
      ? { connected: true, name: 'HR DEVICE' }
      : null;

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <HeaderBar title="LIVE WORKOUT" deviceStatusBadge={deviceBadge} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ReconnectingBanner visible={reconnecting} />

        {/* Duration Clock Section */}
        <View style={styles.durationSection}>
          <Text style={styles.durationCaps}>DURATION</Text>
          <Text style={styles.timerText}>{formattedDuration}</Text>
        </View>

        {/* Heart Rate Display & Zone Indicator */}
        <View style={styles.heartSection}>
          <BpmReadout bpm={currentBpm} />
          <HrZoneBar bpm={currentBpm} />
        </View>

        {/* 2x2 Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="AVG BPM"
              value={avgBpmDisplay}
              unit={avgBpmDisplay !== '—' ? 'bpm' : undefined}
            />
            <StatCard
              label="MAX BPM"
              value={maxBpmDisplay}
              unit={maxBpmDisplay !== '—' ? 'bpm' : undefined}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="CALORIES" value={caloriesDisplay} unit="kcal" />
            <StatCard
              label="EFFORT"
              value={
                rollingAvgText === t('workout.noData') ? '—' : rollingAvgText
              }
              unit={rollingAvgText !== t('workout.noData') ? 'bpm' : undefined}
            />
          </View>
        </View>

        {/* Rolling Avg label for test assertions */}
        <Text style={styles.rollingAvgLabelText}>
          {t('workout.rollingAvgLabel')}: {rollingAvgText}
        </Text>

        {/* Workout Control Buttons */}
        <View style={styles.controlsContainer}>
          {(status === 'idle' || status === 'stopped') && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryPillButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={start}
              accessibilityRole="button"
            >
              <Ionicons
                name="play"
                size={20}
                color={colors.onPrimaryContainer}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryPillButtonText}>
                {t('workout.start')}
              </Text>
            </Pressable>
          )}

          {status === 'active' && (
            <View style={styles.dualControlsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryPillButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={pause}
                accessibilityRole="button"
              >
                <Ionicons
                  name="pause"
                  size={18}
                  color={colors.onSurface}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.secondaryPillButtonText}>
                  {t('workout.pause')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryPillButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={stop}
                accessibilityRole="button"
              >
                <Ionicons
                  name="square"
                  size={18}
                  color={colors.onPrimaryContainer}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryPillButtonText}>
                  {t('workout.stop')}
                </Text>
              </Pressable>
            </View>
          )}

          {status === 'paused' && (
            <View style={styles.dualControlsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryPillButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={resume}
                accessibilityRole="button"
              >
                <Ionicons
                  name="play"
                  size={18}
                  color={colors.onPrimaryContainer}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryPillButtonText}>
                  {t('workout.resume')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.dangerPillButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={stop}
                accessibilityRole="button"
              >
                <Ionicons
                  name="square"
                  size={18}
                  color={colors.onErrorContainer}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.dangerPillButtonText}>
                  {t('workout.stop')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Back to pairing link when idle */}
        {status === 'idle' && (
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>{t('workout.backToPairing')}</Text>
          </Link>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <BottomNavBar currentRoute="workout" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.containerPadding,
    paddingTop: space.unit * 3,
    paddingBottom: space.unit * 6,
    alignItems: 'center',
  },
  durationSection: {
    alignItems: 'center',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 3,
  },
  durationCaps: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    marginBottom: 4,
  },
  timerText: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLg.lineHeight,
    letterSpacing: 0.5,
  },
  heartSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: space.unit * 4,
  },
  statsGrid: {
    width: '100%',
    gap: space.gridGutter,
    marginBottom: space.unit * 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: space.gridGutter,
  },
  rollingAvgLabelText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    marginBottom: space.unit * 4,
  },
  controlsContainer: {
    width: '100%',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 3,
  },
  dualControlsRow: {
    flexDirection: 'row',
    gap: space.gridGutter,
    width: '100%',
  },
  primaryPillButton: {
    flex: 1,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryPillButtonText: {
    color: colors.onPrimaryContainer,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '700',
  },
  secondaryPillButton: {
    flex: 1,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillButtonText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
  },
  dangerPillButton: {
    flex: 1,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.errorContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerPillButtonText: {
    color: colors.onErrorContainer,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  link: {
    padding: space.unit * 2,
  },
  linkText: {
    color: colors.primary,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '500',
  },
});
