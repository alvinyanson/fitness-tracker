import type { RoutePoint } from '@/interfaces/location';
import {
  calculateRouteDistance,
  haversineDistance,
  MAX_PLAUSIBLE_ACCURACY_METERS,
} from '@/services/location/distanceMath';

describe('distanceMath', () => {
  describe('MAX_PLAUSIBLE_ACCURACY_METERS', () => {
    it('is configured to 50 meters', () => {
      expect(MAX_PLAUSIBLE_ACCURACY_METERS).toBe(50);
    });
  });

  describe('haversineDistance', () => {
    it('returns 0 for identical coordinates', () => {
      expect(haversineDistance(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
      expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    });

    it('is symmetric regardless of point order', () => {
      const d1 = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
      const d2 = haversineDistance(34.0522, -118.2437, 37.7749, -122.4194);
      expect(d1).toBeCloseTo(d2, 5);
    });

    it('calculates expected distance along the equator (1 degree longitude approx 111.195 km)', () => {
      const distance = haversineDistance(0, 0, 0, 1);
      // 2 * pi * 6,371,000 / 360 = ~111,194.9 meters
      expect(distance).toBeGreaterThan(111_000);
      expect(distance).toBeLessThan(111_500);
    });

    it('calculates known distance between Paris and London (~344 km)', () => {
      // London (51.5074, -0.1278), Paris (48.8566, 2.3522)
      const distance = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
      expect(Math.round(distance / 1000)).toBe(344);
    });

    it('handles exact antipodal coordinates without producing NaN', () => {
      // Antipodal points: (0, 0) and (0, 180)
      const distance = haversineDistance(0, 0, 0, 180);
      expect(Number.isFinite(distance)).toBe(true);
      expect(distance).toBeCloseTo(Math.PI * 6_371_000, -3);
    });
  });

  describe('calculateRouteDistance', () => {
    const createPoint = (
      lat: number,
      lon: number,
      accuracy: number | null = 5,
      timestamp: number = Date.now(),
    ): RoutePoint => ({
      latitude: lat,
      longitude: lon,
      altitude: 10,
      accuracy,
      timestamp,
    });

    it('returns 0 for empty, single-point, or invalid input', () => {
      expect(calculateRouteDistance([])).toBe(0);
      expect(calculateRouteDistance([createPoint(0, 0)])).toBe(0);
    });

    it('calculates cumulative distance across multiple valid points', () => {
      const p1 = createPoint(0, 0, 10);
      const p2 = createPoint(0, 0.01, 10); // ~1112m
      const p3 = createPoint(0, 0.02, 10); // ~1112m

      const total = calculateRouteDistance([p1, p2, p3]);
      const leg1 = haversineDistance(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude,
      );
      const leg2 = haversineDistance(
        p2.latitude,
        p2.longitude,
        p3.latitude,
        p3.longitude,
      );

      expect(total).toBeCloseTo(leg1 + leg2, 4);
      expect(total).toBeGreaterThan(2200);
      expect(total).toBeLessThan(2250);
    });

    it('skips points with accuracy worse than 50 meters and connects adjacent valid points', () => {
      const p1 = createPoint(0, 0, 5);
      const p2 = createPoint(0, 0.01, 5);
      // Inaccurate glitch fix
      const pGlitch = createPoint(10, 10, 51);
      const p3 = createPoint(0, 0.02, 15);

      const total = calculateRouteDistance([p1, p2, pGlitch, p3]);
      const expected =
        haversineDistance(
          p1.latitude,
          p1.longitude,
          p2.latitude,
          p2.longitude,
        ) +
        haversineDistance(p2.latitude, p2.longitude, p3.latitude, p3.longitude);

      expect(total).toBeCloseTo(expected, 4);
    });

    it('accepts points where accuracy is exactly 50 meters', () => {
      const p1 = createPoint(0, 0, 50);
      const p2 = createPoint(0, 0.01, 50);

      const total = calculateRouteDistance([p1, p2]);
      expect(total).toBeGreaterThan(1000);
    });

    it('accepts points where accuracy is null (unknown accuracy)', () => {
      const p1 = createPoint(0, 0, null);
      const p2 = createPoint(0, 0.01, null);

      const total = calculateRouteDistance([p1, p2]);
      expect(total).toBeGreaterThan(1000);
    });

    it('skips points with non-finite or invalid coordinates and negative accuracy', () => {
      const p1 = createPoint(0, 0, 10);
      const pInvalidLat = createPoint(100, 0, 10);
      const pInvalidLon = createPoint(0, 200, 10);
      const pNegativeAcc = createPoint(0, 0.005, -5);
      const pNaN = createPoint(NaN, 0, 10);
      const p2 = createPoint(0, 0.01, 10);

      const total = calculateRouteDistance([
        p1,
        pInvalidLat,
        pInvalidLon,
        pNegativeAcc,
        pNaN,
        p2,
      ]);

      const expected = haversineDistance(0, 0, 0, 0.01);
      expect(total).toBeCloseTo(expected, 4);
    });

    it('returns 0 if filtering leaves fewer than 2 valid points', () => {
      const p1 = createPoint(0, 0, 80); // skipped
      const p2 = createPoint(0, 1, 100); // skipped
      const p3 = createPoint(0, 2, 10); // 1 valid point left

      expect(calculateRouteDistance([p1, p2, p3])).toBe(0);
    });

    it('gracefully handles sparse arrays with null or undefined points', () => {
      const p1 = createPoint(0, 0, 10);
      const p2 = createPoint(0, 0.01, 10);
      // @ts-expect-error test sparse/malformed array at runtime
      const total = calculateRouteDistance([p1, null, undefined, p2]);
      const expected = haversineDistance(0, 0, 0, 0.01);
      expect(total).toBeCloseTo(expected, 4);
    });
  });
});
