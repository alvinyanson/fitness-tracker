import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { HeaderBar } from '@/components/HeaderBar';
import { ResponsiveContent } from '@/components/ResponsiveContent';
import { HealthConnectStatusCard } from '@/components/HealthConnectStatusCard';
import { HealthConnectSyncQueueCard } from '@/components/HealthConnectSyncQueueCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import { SettingsRow } from '@/components/SettingsRow';
import { useAuth } from '@/hooks/useAuth';
import { useHealthConnectAvailability } from '@/hooks/useHealthConnectAvailability';
import { useHealthConnectSyncQueue } from '@/hooks/useHealthConnectSyncQueue';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { useUnitFormat } from '@/hooks/useUnitFormat';
import { type LocaleCode, SUPPORTED_LOCALES } from '@/interfaces/i18n';
import { SUPPORTED_UNIT_SYSTEMS, type UnitSystem } from '@/interfaces/units';
import { colors, space, type as typeStyles } from '@/theme';

const LANGUAGE_KEY_MAP: Record<LocaleCode, string> = {
  en: 'settings.languageEnglish',
  ja: 'settings.languageJapanese',
};

const UNIT_SYSTEM_KEY_MAP: Record<UnitSystem, string> = {
  metric: 'settings.unitsMetric',
  imperial: 'settings.unitsImperial',
};

export default function SettingsScreen() {
  const { t, language, setLanguage } = useTranslation();
  const { unitSystem, setUnitSystem } = useUnitFormat();
  const { availability, retry, openPlayStoreListing } =
    useHealthConnectAvailability();
  const { status, summary, lastResult, syncNow } = useHealthConnectSyncQueue({
    title: t('healthConnect.syncSessionTitle'),
  });
  const { isOffline } = useNetworkStatus();
  const {
    status: authStatus,
    user: authUser,
    errorReason: authErrorReason,
    pendingProvider,
    isGoogleSignInAvailable,
    signIn,
    signInAsGuest,
    signOut,
  } = useAuth();

  const unitOptions: SegmentOption<UnitSystem>[] = SUPPORTED_UNIT_SYSTEMS.map(
    (system) => ({
      value: system,
      label: t(UNIT_SYSTEM_KEY_MAP[system]),
      accessibilityHint: t('settings.unitsOptionHint'),
    }),
  );

  const languageOptions: SegmentOption<LocaleCode>[] = SUPPORTED_LOCALES.map(
    (locale) => ({
      value: locale,
      label: t(LANGUAGE_KEY_MAP[locale]),
      accessibilityHint: t('settings.languageOptionHint'),
    }),
  );

  return (
    <View style={styles.container}>
      <HeaderBar title={t('settings.headerTitle')} icon="settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <OfflineBanner visible={isOffline} />

          <View style={styles.section}>
            <AccountCard
              status={authStatus}
              user={authUser}
              errorReason={authErrorReason}
              isOffline={isOffline}
              pendingProvider={pendingProvider}
              isGoogleSignInAvailable={isGoogleSignInAvailable}
              onSignIn={signIn}
              onSignInAsGuest={signInAsGuest}
              onSignOut={signOut}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel} accessibilityRole="header">
              {t('settings.unitsLabel')}
            </Text>
            <SettingsRow
              icon="speedometer-outline"
              label={t('settings.unitsMeasurementSystem')}
            >
              <SegmentedControl
                options={unitOptions}
                value={unitSystem}
                onChange={setUnitSystem}
              />
            </SettingsRow>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel} accessibilityRole="header">
              {t('settings.languageLabel')}
            </Text>
            <SettingsRow
              icon="globe-outline"
              label={t('settings.languageLabel')}
            >
              <SegmentedControl
                options={languageOptions}
                value={language}
                onChange={setLanguage}
              />
            </SettingsRow>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
});
