import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNavBar } from '@/components/BottomNavBar';
import { HeaderBar } from '@/components/HeaderBar';
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
      <HeaderBar title={t('settings.headerTitle')} icon="settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            {t('settings.languageLabel')}
          </Text>
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
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={
                      isActive ? colors.onPrimaryContainer : colors.onSurface
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      isActive && styles.optionTextActive,
                    ]}
                  >
                    {optionLabel}
                  </Text>
                  {isActive && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.onPrimaryContainer}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
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
      </ScrollView>

      <BottomNavBar currentRoute="settings" />
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
  },
  section: {
    marginBottom: space.stackGap,
  },
  sectionLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
    marginBottom: space.unit * 2,
  },
  optionsList: {
    gap: space.unit * 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
    padding: space.unit * 3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  optionRowActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    color: colors.onSurface,
    fontSize: typeStyles.bodyMd.fontSize,
    fontWeight: '500',
    lineHeight: typeStyles.bodyMd.lineHeight,
  },
  optionTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
});
