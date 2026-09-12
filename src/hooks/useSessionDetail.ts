import { useCallback, useMemo } from 'react';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type { SessionRecord } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import { HR_CHART_MAX_POINTS } from '@/services/session/hrChartSeries';
import {
  deleteSession,
  getHrSamples,
  getSessionRecord,
} from '@/services/storage/sessionHistoryStorage';

export interface SessionDetail {
  record: SessionRecord | null;
  chartSamples: HeartRateSample[];
  remove: () => void;
}

/** Single-session read/delete, so the summary body can live in `components/`. */
export function useSessionDetail(id: string | null): SessionDetail {
  const { record, chartSamples } = useMemo(() => {
    if (!id) {
      return { record: null, chartSamples: [] };
    }
    try {
      const rec = getSessionRecord(id);
      if (!rec) {
        return { record: null, chartSamples: [] };
      }
      const samples = getHrSamples(id, { limit: HR_CHART_MAX_POINTS * 2 });
      return { record: rec, chartSamples: samples };
    } catch (error) {
      reportError(error, { scope: 'useSessionDetail.getSessionRecord', id });
      return { record: null, chartSamples: [] };
    }
  }, [id]);

  const remove = useCallback(() => {
    if (!id) {
      return;
    }
    try {
      deleteSession(id);
    } catch (error) {
      reportError(error, { scope: 'useSessionDetail.deleteSession', id });
    }
  }, [id]);

  return { record, chartSamples, remove };
}
