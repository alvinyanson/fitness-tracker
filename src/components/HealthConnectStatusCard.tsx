import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HealthConnectAvailability } from '@/interfaces/healthConnect';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, space, textStyle } from '@/theme';
import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';

export interface HealthConnectStatusCardProps {
  availability: HealthConnectAvailability | 'checking';
  onRetry: () => void;
  onOpenPlayStore: () => void;
}

/** Copy and actions per availability state. */
const STATUS_CONTENT: Record<
  HealthConnectAvailability | 'checking',
  { statusKey: string; descriptionKey: string; showActions: boolean }
> = {
  checking: {
    statusKey: 'healthConnect.statusChecking',
    descriptionKey: 'healthConnect.checkingDescription',
    showActions: false,
  },
  available: {
    statusKey: 'healthConnect.statusAvailable',
    descriptionKey: 'healthConnect.availableDescription',
    showActions: false,
  },
  'needs-install': {
    statusKey: 'healthConnect.statusNeedsInstall',
    descriptionKey: 'healthConnect.needsInstallDescription',
    showActions: true,
  },
  'needs-update': {
    statusKey: 'healthConnect.statusNeedsUpdate',
    descriptionKey: 'healthConnect.needsUpdateDescription',
    showActions: true,
  },
  unsupported: {
    statusKey: 'healthConnect.statusUnsupported',
    descriptionKey: 'healthConnect.unsupportedDescription',
    showActions: false,
  },
};

export function HealthConnectStatusCard({
  availability,
  onRetry,
  onOpenPlayStore,
}: HealthConnectStatusCardProps): JSX.Element {
  const { t } = useTranslation();

  const content = STATUS_CONTENT[availability];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('healthConnect.title')}
      </Text>
      <Card>
        <Text style={styles.statusText}>{t(content.statusKey)}</Text>
        <Text style={styles.description}>{t(content.descriptionKey)}</Text>
        {content.showActions && (
          <View style={styles.actionRow}>
            <ActionButton
              label={t('healthConnect.openPlayStore')}
              onPress={onOpenPlayStore}
              accessibilityLabel={t('healthConnect.openPlayStore')}
              accessibilityHint={t('healthConnect.openPlayStoreHint')}
            />
            <ActionButton
              variant="secondary"
              label={t('healthConnect.retry')}
              onPress={onRetry}
              accessibilityLabel={t('healthConnect.retry')}
              accessibilityHint={t('healthConnect.retryHint')}
            />
          </View>
        )}
      </Card>
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
  statusText: {
    color: colors.onSurface,
    ...textStyle('headlineMd'),
  },
  description: {
    color: colors.onSurfaceVariant,
    ...textStyle('bodyMd'),
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.unit * 2,
    marginTop: space.unit * 2,
  },
});
