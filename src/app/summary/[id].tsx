import { useMemo } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNavBar } from '@/components/BottomNavBar';
import { HeaderBar } from '@/components/HeaderBar';
import { HealthConnectSyncBadge } from '@/components/HealthConnectSyncBadge';
import { StatCard } from '@/components/StatCard';
import { useHealthConnectSessionSync } from '@/hooks/useHealthConnectSessionSync';
import { useTranslation } from '@/hooks/useTranslation';
import type { SummaryRouteParams } from '@/interfaces/navigation';
import { formatDuration } from '@/services/formatDuration';
import {
  deleteSession,
  getSession,
} from '@/services/storage/sessionHistoryStorage';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, radii, space, type as typeStyles } from '@/theme';
import { formatDate } from '@/utils/formatDate';

export default function SummaryScreen() {
  const { id: rawId } = useLocalSearchParams<SummaryRouteParams>();
  const id =
    typeof rawId === 'string'
      ? rawId
      : Array.isArray(rawId)
        ? rawId[0]
        : undefined;
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);

  const session = useMemo(() => {
    if (!id) {
      return null;
    }
    return getSession(id);
  }, [id]);

  const {
    state: syncState,
    reason: syncReason,
    syncedAt,
    retry: handleRetrySync,
  } = useHealthConnectSessionSync(session, {
    title: t('healthConnect.syncSessionTitle'),
  });

  const handleDelete = () => {
    if (!id) {
      return;
    }
    Alert.alert(t('summary.deleteTitle'), t('summary.deleteMessage'), [
      { text: t('summary.deleteCancel'), style: 'cancel' },
      {
        text: t('summary.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          deleteSession(id);
          router.replace('/history');
        },
      },
    ]);
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <HeaderBar title={t('summary.title')} showSignalIcon={false} />
        <View style={styles.notFoundContent}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.onSurfaceVariant}
            style={styles.notFoundIcon}
          />
          <Text style={styles.notFoundTitle} accessibilityRole="header">
            {t('summary.notFoundTitle')}
          </Text>
          <Text style={styles.notFoundMessage}>
            {t('summary.notFoundMessage')}
          </Text>
          <Link
            href="/history"
            style={styles.link}
            accessibilityRole="link"
            accessibilityLabel={t('summary.backToHistory')}
            accessibilityHint={t('summary.backToHistoryHint')}
          >
            <Text style={styles.linkText}>{t('summary.backToHistory')}</Text>
          </Link>
        </View>
        <BottomNavBar currentRoute="history" />
      </View>
    );
  }

  const startDate = new Date(session.startedAt);
  const formattedDate = formatDate(startDate, language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const elapsedSeconds = Math.floor(session.stats.durationMs / 1000);
  const formattedDuration = formatDuration(elapsedSeconds);

  const avgHrDisplay =
    session.stats.avgHr !== null ? `${session.stats.avgHr}` : '—';
  const maxHrDisplay =
    session.stats.maxHr !== null ? `${session.stats.maxHr}` : '—';
  const minHrDisplay =
    session.stats.minHr !== null ? `${session.stats.minHr}` : '—';

  return (
    <View style={styles.container}>
      <HeaderBar title={t('summary.title')} showSignalIcon={false} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Completion Checkmark Badge & Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.badgeCircle}>
            <Ionicons
              name="checkmark"
              size={28}
              color={colors.primaryContainer}
            />
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {t('summary.workoutComplete')}
          </Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {/* Duration Clock Section */}
        <View
          style={styles.durationSection}
          accessible={true}
          accessibilityRole="timer"
          accessibilityLabel={`${t('summary.totalDuration')}: ${formattedDuration}`}
        >
          <Text style={styles.timerText}>{formattedDuration}</Text>
          <Text style={styles.durationCaps}>{t('summary.totalDuration')}</Text>
        </View>

        {/* 2x2 Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label={t('summary.avgHr')}
              value={avgHrDisplay}
              unit={session.stats.avgHr !== null ? 'bpm' : undefined}
            />
            <StatCard
              label={t('summary.maxHr')}
              value={maxHrDisplay}
              unit={session.stats.maxHr !== null ? 'bpm' : undefined}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label={t('summary.minHr')}
              value={minHrDisplay}
              unit={session.stats.minHr !== null ? 'bpm' : undefined}
            />
            <StatCard
              label={t('summary.samples')}
              value={`${session.stats.sampleCount}`}
            />
          </View>
        </View>

        {/* Explicit No HR Recorded Notice */}
        {session.stats.avgHr === null && (
          <View style={styles.noHrContainer}>
            <Ionicons
              name="heart-dislike-outline"
              size={20}
              color={colors.onSurfaceVariant}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.noHrText}>{t('summary.noHeartRate')}</Text>
          </View>
        )}

        {/* Health Connect Sync State */}
        <HealthConnectSyncBadge
          state={syncState}
          reason={syncReason}
          syncedAt={syncedAt}
          onRetry={handleRetrySync}
        />

        {/* Delete Session Button */}
        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryPillButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={t('summary.deleteAction')}
            accessibilityHint={t('summary.deleteHint')}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.error}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.deleteButtonText}>
              {t('summary.deleteAction')}
            </Text>
          </Pressable>
        </View>

        {/* Back to History Link */}
        <Link
          href="/history"
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel={t('summary.backToHistory')}
          accessibilityHint={t('summary.backToHistoryHint')}
        >
          <Text style={styles.linkText}>{t('summary.backToHistory')}</Text>
        </Link>
      </ScrollView>

      <BottomNavBar currentRoute="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notFoundContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  notFoundIcon: {
    marginBottom: space.stackGap,
  },
  notFoundTitle: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLg.lineHeight,
    marginBottom: space.stackGap,
    textAlign: 'center',
  },
  notFoundMessage: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    lineHeight: typeStyles.bodyMd.lineHeight,
    textAlign: 'center',
    marginBottom: space.unit * 4,
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
  heroHeader: {
    alignItems: 'center',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 2,
  },
  badgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.unit * 2,
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTitle: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLgMobile.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLgMobile.lineHeight,
    marginBottom: 4,
  },
  dateText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: '500',
  },
  durationSection: {
    alignItems: 'center',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 4,
  },
  durationCaps: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    marginTop: 4,
  },
  timerText: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLg.lineHeight,
    letterSpacing: 0.5,
  },
  statsGrid: {
    width: '100%',
    gap: space.gridGutter,
    marginBottom: space.unit * 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: space.gridGutter,
  },
  noHrContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: space.unit * 3,
    borderRadius: radii.md,
    marginBottom: space.unit * 4,
    width: '100%',
  },
  noHrText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    lineHeight: typeStyles.labelSm.lineHeight,
    flex: 1,
  },
  actionContainer: {
    width: '100%',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 3,
  },
  secondaryPillButton: {
    width: '100%',
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
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
