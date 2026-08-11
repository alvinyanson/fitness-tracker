import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface HistoryListItemProps {
  id: string;
  dateLabel: string;
  durationLabel: string;
  avgHrLabel: string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function HistoryListItem({
  id,
  dateLabel,
  durationLabel,
  avgHrLabel,
  onPress,
  onLongPress,
}: HistoryListItemProps): ReactNode {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(id)}
      onLongPress={() => onLongPress(id)}
      accessibilityRole="button"
      accessibilityLabel={`${dateLabel} ${t('history.sessionTitle')}`}
    >
      <View style={styles.iconAvatar}>
        <MaterialCommunityIcons
          name="dumbbell"
          size={22}
          color={colors.surfaceTint}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.dateLabel} numberOfLines={1}>
          {dateLabel}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {t('history.sessionTitle')}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.statText}>{durationLabel}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name="heart-outline"
              size={14}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.statText}>{avgHrLabel}</Text>
          </View>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: space.unit * 4,
    marginBottom: space.unit * 3,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  rowPressed: {
    opacity: 0.8,
    backgroundColor: colors.surfaceContainerHigh,
  },
  iconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.unit * 3,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.onSurface,
    fontSize: typeStyles.bodyLg.fontSize,
    fontWeight: '600',
    lineHeight: typeStyles.bodyLg.lineHeight,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelSm.fontSize,
    fontWeight: '500',
  },
});
