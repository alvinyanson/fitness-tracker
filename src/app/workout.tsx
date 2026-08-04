import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type as typeStyles, space } from '@/theme';

export default function WorkoutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Back to Pairing</Text>
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
