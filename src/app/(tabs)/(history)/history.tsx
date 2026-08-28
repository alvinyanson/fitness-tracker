import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { ResponsiveContent } from '@/components/ResponsiveContent';
import { SessionHistoryList } from '@/components/SessionHistoryList';
import { SessionSummaryView } from '@/components/SessionSummaryView';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, paneWidthStyle, space } from '@/theme';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { entries, remove } = useSessionHistory();
  const { isTwoPane, masterPaneWidth } = useResponsiveLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Two-pane needs something in the right pane: default to the newest session,
  // and drop the selection when the selected session disappears.
  useEffect(() => {
    if (!isTwoPane) {
      return;
    }
    if (selectedId !== null && entries.some((e) => e.id === selectedId)) {
      return;
    }
    setSelectedId(entries[0]?.id ?? null);
  }, [isTwoPane, entries, selectedId]);

  const handleSelect = useCallback(
    (id: string) => {
      if (isTwoPane) {
        setSelectedId(id);
        return;
      }
      router.push(`/summary/${id}`);
    },
    [isTwoPane],
  );

  const handleDeleted = useCallback(
    (id: string) => {
      remove(id);
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [remove],
  );

  const handleLongPress = useCallback(
    (id: string) => {
      Alert.alert(t('summary.deleteTitle'), t('summary.deleteMessage'), [
        { text: t('summary.deleteCancel'), style: 'cancel' },
        {
          text: t('summary.deleteConfirm'),
          style: 'destructive',
          onPress: () => handleDeleted(id),
        },
      ]);
    },
    [t, handleDeleted],
  );

  const list = (
    <SessionHistoryList
      entries={entries}
      selectedId={isTwoPane ? selectedId : null}
      onSelect={handleSelect}
      onDelete={handleLongPress}
    />
  );

  return (
    <View style={styles.container}>
      <HeaderBar title={t('history.headerTitle')} icon="history" />

      {isTwoPane ? (
        <View style={styles.panes}>
          <View style={[styles.masterPane, paneWidthStyle(masterPaneWidth)]}>
            {list}
          </View>
          <View style={styles.detailPane}>
            <SessionSummaryView
              sessionId={selectedId}
              variant="pane"
              onDeleted={handleDeleted}
            />
          </View>
        </View>
      ) : (
        <ResponsiveContent style={styles.singlePane}>{list}</ResponsiveContent>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  singlePane: {
    flex: 1,
  },
  panes: {
    flex: 1,
    flexDirection: 'row',
  },
  masterPane: {
    borderRightWidth: 1,
    borderRightColor: colors.surfaceContainerHigh,
    paddingHorizontal: space.containerPadding,
  },
  detailPane: {
    flex: 1,
  },
});
