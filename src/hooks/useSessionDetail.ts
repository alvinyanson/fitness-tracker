import { useCallback, useMemo } from 'react';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type { RoutePoint } from '@/interfaces/location';
import type { SessionRecord } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import { simplifyRoute } from '@/services/location/simplifyRoute';
import { HR_CHART_MAX_POINTS } from '@/services/session/hrChartSeries';
import {
  deleteSession,
  getHrSamples,
  getRoutePoints,
  getSessionRecord,
} from '@/services/storage/sessionHistoryStorage';

export interface SessionDetail {
  record: SessionRecord | null;
  chartSamples: HeartRateSample[];
  /** Loaded from SQLite route_points; empty if no GPS was recorded. */
  routePoints: RoutePoint[];
  remove: () => void;
}

/** Memoizes downsampled GeoJSON [lng, lat] coordinates for a route point series. */
export function useSimplifiedRoute(
  routePoints: RoutePoint[],
): [number, number][] {
  return useMemo(() => {
    if (!routePoints || routePoints.length < 2) {
      return [];
    }
    return simplifyRoute(routePoints);
  }, [routePoints]);
}

/** Single-session read/delete, so the summary body can live in `components/`. */
export function useSessionDetail(id: string | null): SessionDetail {
  const { record, chartSamples, routePoints } = useMemo(() => {
    if (!id) {
      return { record: null, chartSamples: [], routePoints: [] };
    }
    try {
      const rec = getSessionRecord(id);
      if (!rec) {
        return { record: null, chartSamples: [], routePoints: [] };
      }
      const samples = getHrSamples(id, { limit: HR_CHART_MAX_POINTS * 2 });
      const points = getRoutePoints(id);
      return { record: rec, chartSamples: samples, routePoints: points };
    } catch (error) {
      reportError(error, { scope: 'useSessionDetail.getSessionRecord', id });
      return { record: null, chartSamples: [], routePoints: [] };
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

  return { record, chartSamples, routePoints, remove };
}
