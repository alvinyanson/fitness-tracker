import type { RoutePoint } from '@/interfaces/location';

/** Target upper bound for rendered map coordinates. */
export const MAX_ROUTE_POINTS = 300;

/** Downsamples route points using uniform stride to GeoJSON [lng, lat] pairs. */
export function simplifyRoute(
  points: RoutePoint[],
  maxPoints?: number,
): [number, number][] {
  const validPoints = points.filter(
    (p) =>
      Boolean(p) && Number.isFinite(p.longitude) && Number.isFinite(p.latitude),
  );

  if (validPoints.length === 0) {
    return [];
  }

  const limit = maxPoints !== undefined ? maxPoints : MAX_ROUTE_POINTS;

  if (limit <= 0 || !Number.isFinite(limit)) {
    return [];
  }

  if (validPoints.length <= limit) {
    return validPoints.map((p) => [p.longitude, p.latitude]);
  }

  if (limit === 1) {
    const first = validPoints[0];
    return first ? [[first.longitude, first.latitude]] : [];
  }

  const stride = Math.ceil((validPoints.length - 1) / (limit - 1));
  const result: [number, number][] = [];

  for (let i = 0; i < validPoints.length - 1; i += stride) {
    const p = validPoints[i];
    if (p) {
      result.push([p.longitude, p.latitude]);
    }
  }

  const lastPoint = validPoints[validPoints.length - 1];
  if (lastPoint) {
    result.push([lastPoint.longitude, lastPoint.latitude]);
  }

  return result;
}
