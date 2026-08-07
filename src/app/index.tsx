import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, type as typeStyles, space } from '@/theme';

export default function PairingScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('pairing.title')}</Text>
      <View style={styles.links}>
        <Link href="/workout" style={styles.link}>
          <Text style={styles.linkText}>{t('pairing.goToWorkout')}</Text>
        </Link>
        <Link href="/history" style={styles.link}>
          <Text style={styles.linkText}>{t('pairing.goToHistory')}</Text>
        </Link>
      </View>
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
  links: {
    gap: space.stackGap,
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
