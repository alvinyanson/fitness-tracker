import type { RoutePoint } from '@/interfaces/location';

/** Rejects GPS points with horizontal accuracy worse than 50 meters. */
export const MAX_PLAUSIBLE_ACCURACY_METERS = 50;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in meters via Haversine. */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const safeA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));

  return EARTH_RADIUS_METERS * c;
}

function isValidRoutePoint(point: RoutePoint): boolean {
  if (!point) {
    return false;
  }
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    return false;
  }

  if (
    point.accuracy !== null &&
    point.accuracy !== undefined &&
    (!Number.isFinite(point.accuracy) ||
      point.accuracy < 0 ||
      point.accuracy > MAX_PLAUSIBLE_ACCURACY_METERS)
  ) {
    return false;
  }

  return true;
}

/** Cumulative distance across an array of RoutePoints, skipping fixes with accuracy > 50m. */
export function calculateRouteDistance(points: RoutePoint[]): number {
  if (!points || points.length < 2) {
    return 0;
  }

  const validPoints = points.filter(isValidRoutePoint);
  if (validPoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1]!;
    const curr = validPoints[i]!;
    totalDistance += haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );
  }

  return totalDistance;
}
