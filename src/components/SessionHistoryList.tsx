import { useCallback, type ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HistoryListItem } from '@/components/HistoryListItem';
import { useTranslation } from '@/hooks/useTranslation';
import type { SessionIndexEntry } from '@/interfaces/session';
import { formatDuration } from '@/services/formatDuration';
import { colors, radii, space, textStyle } from '@/theme';
import { formatRelativeDate } from '@/utils/formatRelativeDate';

export interface SessionHistoryListProps {
  entries: SessionIndexEntry[];
  /** Highlight + `accessibilityState.selected`; two-pane only. */
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Called with the id *after* the caller's confirmation `Alert`. */
  onDelete: (id: string) => void;
}

export function SessionHistoryList({
  entries,
  selectedId = null,
  onSelect,
  onDelete,
}: SessionHistoryListProps): ReactNode {
  const { t, language } = useTranslation();

  const renderItem = useCallback(
    ({ item }: { item: SessionIndexEntry }) => {
      const dateLabel = formatRelativeDate(
        new Date(item.startedAt),
        new Date(),
        language,
      );
      const durationLabel = formatDuration(Math.floor(item.durationMs / 1000));
      const avgHrLabel =
        item.avgHr !== null ? `${item.avgHr} ${t('history.avgHrUnit')}` : '—';

      return (
        <View
          testID={`session-row-${item.id}`}
          style={selectedId === item.id ? styles.selectedWrapper : null}
          accessibilityState={{ selected: selectedId === item.id }}
        >
          <HistoryListItem
            id={item.id}
            dateLabel={dateLabel}
            durationLabel={durationLabel}
            avgHrLabel={avgHrLabel}
            onPress={onSelect}
            onLongPress={onDelete}
          />
        </View>
      );
    },
    [language, t, onSelect, onDelete, selectedId],
  );

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="bar-chart-outline"
          size={48}
          color={colors.onSurfaceVariant}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle} accessibilityRole="header">
          {t('history.emptyTitle')}
        </Text>
        <Text style={styles.emptyMessage}>{t('history.emptyMessage')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      extraData={selectedId}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: space.unit * 3,
    paddingBottom: space.unit * 6,
  },
  selectedWrapper: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.containerPadding,
  },
  emptyIcon: {
    marginBottom: space.stackGap,
  },
  emptyTitle: {
    color: colors.onSurface,
    ...textStyle('headlineLg'),
    fontWeight: '700',
    marginBottom: space.stackGap,
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.onSurfaceVariant,
    ...textStyle('bodyMd'),
    textAlign: 'center',
  },
});
