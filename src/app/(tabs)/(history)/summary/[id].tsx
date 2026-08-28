import { router, useLocalSearchParams } from 'expo-router';
import { SessionSummaryView } from '@/components/SessionSummaryView';
import type { SummaryRouteParams } from '@/interfaces/navigation';

export default function SummaryScreen() {
  const { id: rawId } = useLocalSearchParams<SummaryRouteParams>();
  const id =
    typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  return (
    <SessionSummaryView
      sessionId={id ?? null}
      variant="screen"
      onDeleted={() => router.replace('/history')}
    />
  );
}
