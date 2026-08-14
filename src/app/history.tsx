import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNavBar } from '@/components/BottomNavBar';
import { HeaderBar } from '@/components/HeaderBar';
import { HistoryListItem } from '@/components/HistoryListItem';
import { useTranslation } from '@/hooks/useTranslation';
import type { SessionIndexEntry } from '@/interfaces/session';
import { formatDuration } from '@/services/formatDuration';
import {
  deleteSession,
  getSessionIndex,
} from '@/services/storage/sessionHistoryStorage';
import { colors, space, type as typeStyles } from '@/theme';
import { formatRelativeDate } from '@/utils/formatRelativeDate';

export default function HistoryScreen() {
  const { t, language } = useTranslation();
  const [entries, setEntries] = useState<SessionIndexEntry[]>(() =>
    getSessionIndex(),
  );

  useFocusEffect(
    useCallback(() => {
      setEntries(getSessionIndex());
    }, []),
  );

  const handlePress = useCallback((id: string) => {
    router.push(`/summary/${id}`);
  }, []);

  const handleLongPress = useCallback(
    (id: string) => {
      Alert.alert(t('summary.deleteTitle'), t('summary.deleteMessage'), [
        { text: t('summary.deleteCancel'), style: 'cancel' },
        {
          text: t('summary.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            deleteSession(id);
            setEntries((prev) => prev.filter((entry) => entry.id !== id));
          },
        },
      ]);
    },
    [t],
  );

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
        <HistoryListItem
          id={item.id}
          dateLabel={dateLabel}
          durationLabel={durationLabel}
          avgHrLabel={avgHrLabel}
          onPress={handlePress}
          onLongPress={handleLongPress}
        />
      );
    },
    [language, t, handlePress, handleLongPress],
  );

  return (
    <View style={styles.container}>
      <HeaderBar title={t('history.title')} showSignalIcon={false} />

      {entries.length === 0 ? (
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
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNavBar currentRoute="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: space.containerPadding,
    paddingTop: space.unit * 3,
    paddingBottom: space.unit * 6,
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
    fontSize: typeStyles.headlineLg.fontSize,
    fontWeight: '700',
    lineHeight: typeStyles.headlineLg.lineHeight,
    marginBottom: space.stackGap,
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.bodyMd.fontSize,
    lineHeight: typeStyles.bodyMd.lineHeight,
    textAlign: 'center',
  },
});
