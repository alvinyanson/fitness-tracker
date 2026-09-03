import type { ReactNode } from 'react';
import { Link } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBar } from '@/components/HeaderBar';
import { HealthConnectSyncBadge } from '@/components/HealthConnectSyncBadge';
import { HrTrendChart } from '@/components/HrTrendChart';
import { ResponsiveContent } from '@/components/ResponsiveContent';
import { StatCard } from '@/components/StatCard';
import { useHealthConnectSessionSync } from '@/hooks/useHealthConnectSessionSync';
import { useSessionDetail } from '@/hooks/useSessionDetail';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDuration } from '@/services/formatDuration';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, radii, space, textStyle } from '@/theme';
import { formatDate } from '@/utils/formatDate';

export interface SessionSummaryViewProps {
  sessionId: string | null;
  /** `'pane'` drops the header and the back link, both meaningless inside a pane. */
  variant?: 'screen' | 'pane';
  onDeleted?: (id: string) => void;
}

interface MessageStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  header: ReactNode;
  /** Trailing content — the back link on the not-found branch. */
  footer?: ReactNode;
}

/** Icon + title + body pane shared by the "nothing selected" and "not found" states. */
function MessageState({
  icon,
  title,
  message,
  header,
  footer,
}: MessageStateProps): ReactNode {
  return (
    <View style={styles.container}>
      {header}
      <View style={styles.messageContent}>
        <Ionicons
          name={icon}
          size={48}
          color={colors.onSurfaceVariant}
          style={styles.messageIcon}
        />
        <Text style={styles.messageTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.messageText}>{message}</Text>
        {footer}
      </View>
    </View>
  );
}

/** A `null` HR stat shows an em dash and drops the unit. */
function hrStat(value: number | null): { value: string; unit?: string } {
  return value !== null ? { value: `${value}`, unit: 'bpm' } : { value: '—' };
}

export function SessionSummaryView({
  sessionId,
  variant = 'screen',
  onDeleted,
}: SessionSummaryViewProps): ReactNode {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const { session, remove } = useSessionDetail(sessionId);
  const isPane = variant === 'pane';

  const {
    state: syncState,
    reason: syncReason,
    syncedAt,
    retry: handleRetrySync,
  } = useHealthConnectSessionSync(session, {
    title: t('healthConnect.syncSessionTitle'),
  });

  const handleDelete = () => {
    if (!sessionId) {
      return;
    }
    Alert.alert(t('summary.deleteTitle'), t('summary.deleteMessage'), [
      { text: t('summary.deleteCancel'), style: 'cancel' },
      {
        text: t('summary.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          remove();
          onDeleted?.(sessionId);
        },
      },
    ]);
  };

  const header = isPane ? null : (
    <HeaderBar title={t('summary.headerTitle')} icon="history" />
  );

  const backLink = isPane ? null : (
    <Link
      href="/history"
      style={styles.link}
      accessibilityRole="link"
      accessibilityLabel={t('summary.backToHistory')}
      accessibilityHint={t('summary.backToHistoryHint')}
    >
      <Text style={styles.linkText}>{t('summary.backToHistory')}</Text>
    </Link>
  );

  // Right-pane placeholder: nothing selected yet. On the route, a missing id is
  // a not-found, not a placeholder.
  if (sessionId === null && isPane) {
    return (
      <MessageState
        icon="list-outline"
        title={t('history.selectSessionTitle')}
        message={t('history.selectSessionMessage')}
        header={header}
      />
    );
  }

  if (!session) {
    return (
      <MessageState
        icon="alert-circle-outline"
        title={t('summary.notFoundTitle')}
        message={t('summary.notFoundMessage')}
        header={header}
        footer={backLink}
      />
    );
  }

  const startDate = new Date(session.startedAt);
  const formattedDate = formatDate(startDate, language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const elapsedSeconds = Math.floor(session.stats.durationMs / 1000);
  const formattedDuration = formatDuration(elapsedSeconds);

  const avgHr = hrStat(session.stats.avgHr);
  const maxHr = hrStat(session.stats.maxHr);
  const minHr = hrStat(session.stats.minHr);

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent style={styles.body}>
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
            <Text style={styles.durationCaps}>
              {t('summary.totalDuration')}
            </Text>
          </View>

          {/* 2x2 Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                label={t('summary.avgHr')}
                value={avgHr.value}
                unit={avgHr.unit}
              />
              <StatCard
                label={t('summary.maxHr')}
                value={maxHr.value}
                unit={maxHr.unit}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                label={t('summary.minHr')}
                value={minHr.value}
                unit={minHr.unit}
              />
              <StatCard
                label={t('summary.samples')}
                value={`${session.stats.sampleCount}`}
              />
            </View>
          </View>

          {/* HR Trend Chart — renders nothing when no sample is plottable */}
          <HrTrendChart
            samples={session.samples}
            startedAt={session.startedAt}
            stats={session.stats}
          />

          {/* Explicit No HR Recorded Notice */}
          {session.stats.avgHr === null && (
            <View style={styles.noHrContainer}>
              <Ionicons
                name="heart-dislike-outline"
                size={20}
                color={colors.onSurfaceVariant}
                style={styles.noHrIcon}
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
                style={styles.deleteIcon}
              />
              <Text style={styles.deleteButtonText}>
                {t('summary.deleteAction')}
              </Text>
            </Pressable>
          </View>

          {backLink}
        </ResponsiveContent>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  messageIcon: {
    marginBottom: space.stackGap,
  },
  messageTitle: {
    color: colors.onSurface,
    ...textStyle('headlineLg'),
    fontWeight: '700',
    marginBottom: space.stackGap,
    textAlign: 'center',
  },
  messageText: {
    color: colors.onSurfaceVariant,
    ...textStyle('bodyMd'),
    textAlign: 'center',
    marginBottom: space.unit * 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: space.unit * 3,
    paddingBottom: space.unit * 6,
  },
  body: {
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
    ...textStyle('headlineLgMobile'),
    fontWeight: '700',
    marginBottom: 4,
  },
  dateText: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
    fontWeight: '500',
  },
  durationSection: {
    alignItems: 'center',
    marginTop: space.unit * 2,
    marginBottom: space.unit * 4,
  },
  durationCaps: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelCaps'),
    marginTop: 4,
  },
  timerText: {
    color: colors.onSurface,
    ...textStyle('headlineLg'),
    fontWeight: '700',
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
  noHrIcon: {
    marginRight: space.unit * 2,
  },
  noHrText: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
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
  deleteIcon: {
    marginRight: space.unit * 1.5,
  },
  deleteButtonText: {
    color: colors.error,
    ...textStyle('bodyLg'),
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
    ...textStyle('bodyMd'),
    fontWeight: '500',
  },
});
