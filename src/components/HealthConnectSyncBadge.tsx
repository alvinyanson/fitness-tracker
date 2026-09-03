import type { ComponentProps, JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  HealthConnectSyncState,
  HealthConnectWriteFailureReason,
} from '@/interfaces/healthConnect';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, space, textStyle } from '@/theme';
import { formatDate } from '@/utils/formatDate';
import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';

export interface HealthConnectSyncBadgeProps {
  state: HealthConnectSyncState;
  reason: HealthConnectWriteFailureReason | null;
  syncedAt: number | null;
  onRetry: () => void;
}

/** Icon, copy and actions per sync state. `descriptionKey` is null where the
 *  description is derived (timestamp for `synced`, reason for `failed`). */
const SYNC_STATE_CONFIG: Record<
  HealthConnectSyncState,
  {
    iconName: ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
    statusKey: string;
    descriptionKey: string | null;
    /** Joins label and description in the accessibility label. */
    separator: string;
    showRetry: boolean;
  }
> = {
  synced: {
    iconName: 'checkmark-circle-outline',
    iconColor: colors.surfaceTint,
    statusKey: 'healthConnect.syncStatusSynced',
    descriptionKey: null,
    separator: ', ',
    showRetry: false,
  },
  syncing: {
    iconName: 'sync-outline',
    iconColor: colors.onSurfaceVariant,
    statusKey: 'healthConnect.syncStatusSyncing',
    descriptionKey: null,
    separator: '',
    showRetry: false,
  },
  unsynced: {
    iconName: 'cloud-outline',
    iconColor: colors.onSurfaceVariant,
    statusKey: 'healthConnect.syncStatusUnsynced',
    descriptionKey: null,
    separator: '',
    showRetry: false,
  },
  failed: {
    iconName: 'alert-circle-outline',
    iconColor: colors.error,
    statusKey: 'healthConnect.syncStatusFailed',
    descriptionKey: null,
    separator: '. ',
    showRetry: true,
  },
  abandoned: {
    iconName: 'alert-circle-outline',
    iconColor: colors.error,
    statusKey: 'healthConnect.syncStatusAbandoned',
    descriptionKey: 'healthConnect.syncReasonAbandoned',
    separator: '. ',
    showRetry: true,
  },
};

/** Failure reason → translation key; unknown/absent reasons read as write-failed. */
const REASON_KEYS: Record<HealthConnectWriteFailureReason, string> = {
  unavailable: 'healthConnect.syncReasonUnavailable',
  'permission-denied': 'healthConnect.syncReasonPermissionDenied',
  'write-failed': 'healthConnect.syncReasonWriteFailed',
};

export function HealthConnectSyncBadge({
  state,
  reason,
  syncedAt,
  onRetry,
}: HealthConnectSyncBadgeProps): JSX.Element {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);

  const config = SYNC_STATE_CONFIG[state];
  const label = t(config.statusKey);

  let description: string | null = null;
  if (state === 'synced') {
    description = syncedAt
      ? t('healthConnect.syncSyncedAt', {
          time: formatDate(new Date(syncedAt), language, {
            timeStyle: 'short',
          }),
        })
      : null;
  } else if (state === 'failed') {
    description = t(
      (reason && REASON_KEYS[reason]) ?? REASON_KEYS['write-failed'],
    );
  } else if (config.descriptionKey) {
    description = t(config.descriptionKey);
  }

  const accessibilityLabel = description
    ? `${label}${config.separator}${description}`
    : label;

  return (
    <View style={styles.container}>
      <Card
        style={styles.card}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.contentRow}>
          <Ionicons
            name={config.iconName}
            size={22}
            color={config.iconColor}
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Text style={styles.statusText}>{label}</Text>
            {description ? (
              <Text style={styles.descriptionText}>{description}</Text>
            ) : null}
          </View>
        </View>

        {config.showRetry ? (
          <View style={styles.actionRow}>
            <ActionButton
              variant="secondary"
              label={t('healthConnect.syncRetry')}
              onPress={onRetry}
              accessibilityLabel={t('healthConnect.syncRetry')}
              accessibilityHint={t('healthConnect.syncRetryHint')}
              style={styles.retryButton}
              labelStyle={styles.retryButtonText}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: space.unit * 4,
  },
  card: {
    padding: space.unit * 3.5,
    // The badge spaces its own rows with marginTop, not the Card stack gap.
    gap: 0,
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
    ...textStyle('bodyMd'),
    fontWeight: '600',
  },
  descriptionText: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
    marginTop: 2,
  },
  actionRow: {
    marginTop: space.unit * 3,
    alignItems: 'flex-start',
  },
  retryButton: {
    paddingVertical: space.unit * 2,
    paddingHorizontal: space.unit * 3.5,
  },
  retryButtonText: {
    ...textStyle('labelSm'),
    fontWeight: '600',
  },
});
