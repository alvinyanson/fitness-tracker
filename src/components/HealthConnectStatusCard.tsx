import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HealthConnectAvailability } from '@/interfaces/healthConnect';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, textStyle } from '@/theme';

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
      <View style={styles.card}>
        <Text style={styles.statusText}>{content.statusText}</Text>
        <Text style={styles.description}>{content.description}</Text>
        {content.showActions && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onOpenPlayStore}
              accessibilityRole="button"
              accessibilityLabel={t('healthConnect.openPlayStore')}
              accessibilityHint={t('healthConnect.openPlayStoreHint')}
            >
              <Text style={styles.primaryButtonText}>
                {t('healthConnect.openPlayStore')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={t('healthConnect.retry')}
              accessibilityHint={t('healthConnect.retryHint')}
            >
              <Text style={styles.secondaryButtonText}>
                {t('healthConnect.retry')}
              </Text>
            </Pressable>
          </View>
        )}
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
  secondaryButton: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radii.md,
    paddingVertical: space.unit * 2.5,
    paddingHorizontal: space.unit * 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...textStyle('bodyMd'),
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
