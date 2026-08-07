import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, type as typeStyles, space } from '@/theme';

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('summary.title')}</Text>
      <Text style={styles.paramText}>{id}</Text>
      <Link href="/history" style={styles.link}>
        <Text style={styles.linkText}>{t('summary.backToHistory')}</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  title: {
    color: colors.onSurface,
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: typeStyles.headlineLg.fontWeight,
    lineHeight: typeStyles.headlineLg.lineHeight,
    marginBottom: space.stackGap,
  },
  paramText: {
    color: colors.primaryContainer,
    fontSize: typeStyles.headlineMd.fontSize,
    fontWeight: typeStyles.headlineMd.fontWeight,
    lineHeight: typeStyles.headlineMd.lineHeight,
    marginBottom: space.stackGap,
  },
  link: {
    padding: space.unit * 3,
  },
  linkText: {
    color: colors.primary,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: typeStyles.bodyLg.fontWeight,
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
});
