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

export function HealthConnectStatusCard({
  availability,
  onRetry,
  onOpenPlayStore,
}: HealthConnectStatusCardProps): JSX.Element {
  const { t } = useTranslation();

  const getStatusContent = () => {
    switch (availability) {
      case 'checking':
        return {
          statusText: t('healthConnect.statusChecking'),
          description: t('healthConnect.checkingDescription'),
          showActions: false,
        };
      case 'available':
        return {
          statusText: t('healthConnect.statusAvailable'),
          description: t('healthConnect.availableDescription'),
          showActions: false,
        };
      case 'needs-install':
        return {
          statusText: t('healthConnect.statusNeedsInstall'),
          description: t('healthConnect.needsInstallDescription'),
          showActions: true,
        };
      case 'needs-update':
        return {
          statusText: t('healthConnect.statusNeedsUpdate'),
          description: t('healthConnect.needsUpdateDescription'),
          showActions: true,
        };
      case 'unsupported':
        return {
          statusText: t('healthConnect.statusUnsupported'),
          description: t('healthConnect.unsupportedDescription'),
          showActions: false,
        };
    }
  };

  const content = getStatusContent();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('healthConnect.title')}
      </Text>
      <Card>
        <Text style={styles.statusText}>{content.statusText}</Text>
        <Text style={styles.description}>{content.description}</Text>
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
