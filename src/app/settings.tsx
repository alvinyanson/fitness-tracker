import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HealthConnectStatusCard } from '@/components/HealthConnectStatusCard';
import { HealthConnectSyncQueueCard } from '@/components/HealthConnectSyncQueueCard';
import { useHealthConnectAvailability } from '@/hooks/useHealthConnectAvailability';
import { useHealthConnectSyncQueue } from '@/hooks/useHealthConnectSyncQueue';
import { useTranslation } from '@/hooks/useTranslation';
import { type LocaleCode, SUPPORTED_LOCALES } from '@/interfaces/i18n';
import { colors, radii, space, type as typeStyles } from '@/theme';

const LANGUAGE_KEY_MAP: Record<LocaleCode, string> = {
  en: 'settings.languageEnglish',
  ja: 'settings.languageJapanese',
};

export default function SettingsScreen() {
  const { t, language, setLanguage } = useTranslation();
  const { availability, retry, openPlayStoreListing } =
    useHealthConnectAvailability();
  const { status, summary, lastResult, syncNow } = useHealthConnectSyncQueue({
    title: t('healthConnect.syncSessionTitle'),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {t('settings.title')}
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t('settings.languageLabel')}</Text>
        <View style={styles.optionsList}>
          {SUPPORTED_LOCALES.map((locale) => {
            const isActive = language === locale;
            const optionLabel = t(LANGUAGE_KEY_MAP[locale]);
            return (
              <Pressable
                key={locale}
                style={[styles.optionRow, isActive && styles.optionRowActive]}
                onPress={() => setLanguage(locale)}
                accessibilityRole="button"
                accessibilityLabel={optionLabel}
                accessibilityHint={t('settings.languageOptionHint')}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.optionText,
                    isActive && styles.optionTextActive,
                  ]}
                >
                  {optionLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <HealthConnectStatusCard
        availability={availability}
        onRetry={retry}
        onOpenPlayStore={openPlayStoreListing}
      />

      <HealthConnectSyncQueueCard
        summary={summary}
        status={status}
        lastResult={lastResult}
        onSyncNow={syncNow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: space.containerPadding,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: typeStyles.headlineLg.fontWeight,
    lineHeight: typeStyles.headlineLg.lineHeight,
    marginBottom: space.stackGap,
    marginTop: space.unit * 4,
  },
  section: {
    marginBottom: space.stackGap,
  },
  label: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: typeStyles.bodyLg.fontWeight,
    lineHeight: typeStyles.bodyLg.lineHeight,
    marginBottom: space.unit * 2,
  },
  optionsList: {
    gap: space.unit * 2,
  },
  optionRow: {
    padding: space.unit * 3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  optionRowActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: typeStyles.bodyLg.fontWeight,
  },
  optionTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
});
