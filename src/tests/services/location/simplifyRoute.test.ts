import type { RoutePoint } from '@/interfaces/location';
import {
  MAX_ROUTE_POINTS,
  simplifyRoute,
} from '@/services/location/simplifyRoute';

function makePoint(seq: number, lat: number, lng: number): RoutePoint {
  return {
    timestamp: 1700000000000 + seq * 1000,
    latitude: lat,
    longitude: lng,
    altitude: 10,
    accuracy: 5,
  };
}

describe('simplifyRoute', () => {
  it('returns empty array when given empty route points', () => {
    expect(simplifyRoute([])).toEqual([]);
  });

  it('maps points directly to [longitude, latitude] GeoJSON tuples when length <= MAX_ROUTE_POINTS', () => {
    const points: RoutePoint[] = [
      makePoint(0, 37.7749, -122.4194),
      makePoint(1, 37.775, -122.4195),
      makePoint(2, 37.7751, -122.4196),
    ];

    const result = simplifyRoute(points);

    expect(result).toEqual([
      [-122.4194, 37.7749],
      [-122.4195, 37.775],
      [-122.4196, 37.7751],
    ]);
  });

  it('downsamples route exceeding MAX_ROUTE_POINTS while retaining <= MAX_ROUTE_POINTS', () => {
    const points: RoutePoint[] = Array.from({ length: 650 }, (_, i) =>
      makePoint(i, 35.0 + i * 0.001, 139.0 + i * 0.001),
    );

    const result = simplifyRoute(points);

    expect(result.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS);
    expect(result.length).toBeGreaterThan(1);
    // Preserves start
    expect(result[0]).toEqual([139.0, 35.0]);
    // Preserves finish
    expect(result[result.length - 1]).toEqual([
      139.0 + 649 * 0.001,
      35.0 + 649 * 0.001,
    ]);
  });

  it('downsamples with custom maxPoints parameter', () => {
    const points: RoutePoint[] = Array.from({ length: 10 }, (_, i) =>
      makePoint(i, 10 + i, 20 + i),
    );

    const result = simplifyRoute(points, 4);

    expect(result.length).toBeLessThanOrEqual(4);
    expect(result[0]).toEqual([20, 10]);
    expect(result[result.length - 1]).toEqual([29, 19]);
  });

  it('preserves exact start and finish for odd and even lengths', () => {
    for (const length of [301, 302, 599, 600, 1000]) {
      const points: RoutePoint[] = Array.from({ length }, (_, i) =>
        makePoint(i, 10 + i * 0.01, 20 + i * 0.01),
      );

      const result = simplifyRoute(points);

      expect(result.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS);
      expect(result[0]).toEqual([points[0]?.longitude, points[0]?.latitude]);
      expect(result[result.length - 1]).toEqual([
        points[length - 1]?.longitude,
        points[length - 1]?.latitude,
      ]);
    }
  });

  it('handles limit edge cases cleanly', () => {
    const points: RoutePoint[] = [makePoint(0, 10, 20), makePoint(1, 11, 21)];

    expect(simplifyRoute(points, 0)).toEqual([]);
    expect(simplifyRoute(points, 1)).toEqual([[20, 10]]);
  });

  it('filters out points with non-finite latitude or longitude', () => {
    const points: RoutePoint[] = [
      makePoint(0, 37.7749, -122.4194),
      makePoint(1, Number.NaN, -122.418),
      makePoint(2, 37.776, Number.POSITIVE_INFINITY),
      makePoint(3, Number.NEGATIVE_INFINITY, -122.416),
      makePoint(4, 37.7849, -122.4094),
    ];

    expect(simplifyRoute(points)).toEqual([
      [-122.4194, 37.7749],
      [-122.4094, 37.7849],
    ]);
  });
});
