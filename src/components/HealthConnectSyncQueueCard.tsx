import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  HealthConnectFlushResult,
  HealthConnectSyncQueueSummary,
} from '@/interfaces/healthConnect';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, textStyle } from '@/theme';

export interface HealthConnectSyncQueueCardProps {
  summary: HealthConnectSyncQueueSummary;
  status: 'idle' | 'flushing';
  lastResult: HealthConnectFlushResult | null;
  onSyncNow: () => void;
}

export function HealthConnectSyncQueueCard({
  summary,
  status,
  lastResult,
  onSyncNow,
}: HealthConnectSyncQueueCardProps): JSX.Element {
  const { t } = useTranslation();

  const isSyncDisabled =
    status === 'flushing' || summary.pending + summary.abandoned === 0;

  const getPendingText = () => {
    if (summary.pending > 0) {
      return t('healthConnect.queuePendingCount', { count: summary.pending });
    }
    return t('healthConnect.queueNothingPending');
  };

  const getLastResultText = (): string | null => {
    if (!lastResult) {
      return null;
    }

    if (lastResult.skipped === 'unavailable') {
      return t('healthConnect.queueSkippedUnavailable');
    }
    if (lastResult.skipped === 'permission-denied') {
      return t('healthConnect.queueSkippedPermissionDenied');
    }

    const totalFailed = lastResult.failed + lastResult.abandoned;
    if (lastResult.synced > 0 && totalFailed > 0) {
      return `${t('healthConnect.queueLastResultSynced', { count: lastResult.synced })} · ${t('healthConnect.queueLastResultFailed', { count: totalFailed })}`;
    }
    if (lastResult.synced > 0) {
      return t('healthConnect.queueLastResultSynced', {
        count: lastResult.synced,
      });
    }
    if (totalFailed > 0) {
      return t('healthConnect.queueLastResultFailed', {
        count: totalFailed,
      });
    }

    return null;
  };

  const buttonLabel =
    status === 'flushing'
      ? t('healthConnect.queueSyncing')
      : t('healthConnect.queueSyncNow');
  const lastResultText = getLastResultText();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('healthConnect.queueTitle')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.statusText}>{getPendingText()}</Text>

        {summary.abandoned > 0 && (
          <Text style={styles.abandonedText}>
            {t('healthConnect.queueAbandonedCount', {
              count: summary.abandoned,
            })}
          </Text>
        )}

        {lastResultText && (
          <Text style={styles.lastResultText}>{lastResultText}</Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isSyncDisabled && styles.buttonDisabled,
              pressed && !isSyncDisabled && styles.buttonPressed,
            ]}
            onPress={onSyncNow}
            disabled={isSyncDisabled}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            accessibilityHint={t('healthConnect.queueSyncNowHint')}
            accessibilityState={{
              disabled: isSyncDisabled,
              busy: status === 'flushing',
            }}
          >
            <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: space.stackGap,
  },
  sectionTitle: {
    color: colors.onSurfaceVariant,
    ...textStyle('bodyLg'),
    marginBottom: space.unit * 2,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    padding: space.unit * 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: space.unit * 2,
  },
  statusText: {
    color: colors.onSurface,
    ...textStyle('headlineMd'),
  },
  abandonedText: {
    color: colors.error,
    ...textStyle('bodyMd'),
  },
  lastResultText: {
    color: colors.onSurfaceVariant,
    ...textStyle('bodyMd'),
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.unit * 2,
    marginTop: space.unit * 2,
  },
  primaryButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.md,
    paddingVertical: space.unit * 2.5,
    paddingHorizontal: space.unit * 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimaryContainer,
    ...textStyle('bodyMd'),
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
