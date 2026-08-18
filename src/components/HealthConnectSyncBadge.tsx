import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  HealthConnectSyncState,
  HealthConnectWriteFailureReason,
} from '@/interfaces/healthConnect';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, radii, space, type as typeStyles } from '@/theme';
import { formatDate } from '@/utils/formatDate';

export interface HealthConnectSyncBadgeProps {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  onRetry: () => void;
}

export function HealthConnectSyncBadge({
  state,
  reason,
  syncedAt,
  onRetry,
}: HealthConnectSyncBadgeProps): JSX.Element {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);

  const getReasonText = (
    failureReason: HealthConnectWriteFailureReason | null,
  ): string => {
    switch (failureReason) {
      case 'unavailable':
        return t('healthConnect.syncReasonUnavailable');
      case 'permission-denied':
        return t('healthConnect.syncReasonPermissionDenied');
      case 'write-failed':
      default:
        return t('healthConnect.syncReasonWriteFailed');
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'synced': {
        const timeStr = syncedAt
          ? formatDate(new Date(syncedAt), language, { timeStyle: 'short' })
          : null;
        const description = timeStr
          ? t('healthConnect.syncSyncedAt', { time: timeStr })
          : null;
        const label = t('healthConnect.syncStatusSynced');
        const accessibilityLabel = description
          ? `${label}, ${description}`
          : label;

        return {
          iconName: 'checkmark-circle-outline' as const,
          iconColor: colors.surfaceTint,
          statusText: label,
          description,
          accessibilityLabel,
          showRetry: false,
        };
      }
      case 'syncing': {
        const label = t('healthConnect.syncStatusSyncing');
        return {
          iconName: 'sync-outline' as const,
          iconColor: colors.onSurfaceVariant,
          statusText: label,
          description: null,
          accessibilityLabel: label,
          showRetry: false,
        };
      }
      case 'unsynced': {
        const label = t('healthConnect.syncStatusUnsynced');
        return {
          iconName: 'cloud-outline' as const,
          iconColor: colors.onSurfaceVariant,
          statusText: label,
          description: null,
          accessibilityLabel: label,
          showRetry: false,
        };
      }
      case 'failed': {
        const label = t('healthConnect.syncStatusFailed');
        const description = getReasonText(reason);
        const accessibilityLabel = `${label}. ${description}`;
        return {
          iconName: 'alert-circle-outline' as const,
          iconColor: colors.error,
          statusText: label,
          description,
          accessibilityLabel,
          showRetry: true,
        };
      }
    }
  };

  const content = renderContent();

  return (
    <View style={styles.container}>
      <View
        style={styles.card}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={content.accessibilityLabel}
      >
        <View style={styles.contentRow}>
          <Ionicons
            name={content.iconName}
            size={22}
            color={content.iconColor}
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Text style={styles.statusText}>{content.statusText}</Text>
            {content.description ? (
              <Text style={styles.descriptionText}>{content.description}</Text>
            ) : null}
          </View>
        </View>

        {content.showRetry ? (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={t('healthConnect.syncRetry')}
              accessibilityHint={t('healthConnect.syncRetryHint')}
            >
              <Text style={styles.retryButtonText}>
                {t('healthConnect.syncRetry')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: space.unit * 4,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    padding: space.unit * 3.5,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: space.unit * 2.5,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  descriptionText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: typeStyles.labelSm.fontWeight,
    lineHeight: typeStyles.labelSm.lineHeight,
    marginTop: 2,
  },
  actionRow: {
    marginTop: space.unit * 3,
    alignItems: 'flex-start',
  },
  retryButton: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radii.md,
    paddingVertical: space.unit * 2,
    paddingHorizontal: space.unit * 3.5,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.onSurface,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.labelSm.lineHeight,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
