import type { RoutePoint } from '@/interfaces/location';
import {
  ALTITUDE_CHART_MAX_POINTS,
  ALTITUDE_SMOOTHING_WINDOW,
  calculateElevationGainLoss,
  computeAltitudeProfile,
  MAX_PLAUSIBLE_ALTITUDE_METERS,
  MIN_ELEVATION_DELTA_METERS,
  MIN_PLAUSIBLE_ALTITUDE_METERS,
  smoothAltitude,
} from '@/services/location/altitudeProfile';

function makePoint(
  lat: number,
  lon: number,
  altitude: number | null,
  accuracy: number | null = 5,
  timestamp = 1700000000000,
): RoutePoint {
  return {
    timestamp,
    latitude: lat,
    longitude: lon,
    altitude,
    accuracy,
  };
}

describe('altitudeProfile service', () => {
  describe('constants', () => {
    it('exports required constants', () => {
      expect(ALTITUDE_SMOOTHING_WINDOW).toBe(5);
      expect(MIN_ELEVATION_DELTA_METERS).toBe(1.0);
    });
  });

  describe('smoothAltitude', () => {
    it('returns empty array when input is empty', () => {
      expect(smoothAltitude([])).toEqual([]);
    });

    it('returns copy of array when windowSize <= 1', () => {
      expect(smoothAltitude([10, 20, 30], 1)).toEqual([10, 20, 30]);
      expect(smoothAltitude([10, 20, 30], 0)).toEqual([10, 20, 30]);
    });

    it('computes centered moving average for a 5-sample window', () => {
      // For [10, 20, 30, 40, 50]:
      // i=0: [0..2] -> (10 + 20 + 30) / 3 = 20
      // i=1: [0..3] -> (10 + 20 + 30 + 40) / 4 = 25
      // i=2: [0..4] -> (10 + 20 + 30 + 40 + 50) / 5 = 30
      // i=3: [1..4] -> (20 + 30 + 40 + 50) / 4 = 35
      // i=4: [2..4] -> (30 + 40 + 50) / 3 = 40
      const smoothed = smoothAltitude([10, 20, 30, 40, 50], 5);
      expect(smoothed).toEqual([20, 25, 30, 35, 40]);
    });

    it('handles arrays shorter than window size', () => {
      // [10, 20]:
      // i=0: [0..1] -> 15
      // i=1: [0..1] -> 15
      expect(smoothAltitude([10, 20], 5)).toEqual([15, 15]);
    });
  });

  describe('calculateElevationGainLoss', () => {
    it('returns 0 gain and loss for empty or single element array', () => {
      expect(calculateElevationGainLoss([])).toEqual({
        gainMeters: 0,
        lossMeters: 0,
      });
      expect(calculateElevationGainLoss([100])).toEqual({
        gainMeters: 0,
        lossMeters: 0,
      });
    });

    it('accumulates deltas >= minDeltaMeters with trend reversal', () => {
      // 100 -> 101.5 (+1.5 >= 1.0) -> enters up mode
      // 101.5 -> 102.0 (+0.5) -> continues up (+2.0 total gain)
      // 102.0 -> 100.0 (-2.0 <= -1.0) -> reverses to down mode (-2.0 loss)
      // 100.0 -> 99.2 (-0.8) -> continues down (-2.8 total loss)
      const result = calculateElevationGainLoss(
        [100, 101.5, 102.0, 100.0, 99.2],
        1.0,
      );
      expect(result.gainMeters).toBeCloseTo(2.0);
      expect(result.lossMeters).toBeCloseTo(2.8);
    });

    it('accumulates gradual climb where consecutive deltas are under 1.0m', () => {
      // 11 points stepping by 0.3m: 100.0, 100.3, 100.6, 100.9, 101.2, ..., 103.0
      const altitudes = Array.from(
        { length: 11 },
        (_, i) => Math.round((100 + i * 0.3) * 10) / 10,
      );
      const result = calculateElevationGainLoss(altitudes, 1.0);
      expect(result.gainMeters).toBeCloseTo(3.0);
      expect(result.lossMeters).toBe(0);
    });

    it('filters out jitter below threshold', () => {
      const result = calculateElevationGainLoss(
        [100, 100.4, 99.8, 100.5, 99.7, 100.2],
        1.0,
      );
      expect(result.gainMeters).toBe(0);
      expect(result.lossMeters).toBe(0);
    });
  });

  describe('computeAltitudeProfile', () => {
    it('returns null for empty array or single point', () => {
      expect(computeAltitudeProfile([], 'metric')).toBeNull();
      expect(
        computeAltitudeProfile([makePoint(37.77, -122.41, 100)], 'metric'),
      ).toBeNull();
    });

    it('returns null when total distance is 0', () => {
      const points = [
        makePoint(37.7749, -122.4194, 100),
        makePoint(37.7749, -122.4194, 110),
        makePoint(37.7749, -122.4194, 120),
      ];
      expect(computeAltitudeProfile(points, 'metric')).toBeNull();
    });

    it('rejects null, non-finite, out-of-bounds, and low-accuracy points', () => {
      const points: RoutePoint[] = [
        makePoint(37.77, -122.41, 100, 5),
        makePoint(37.771, -122.41, null, 5), // null altitude
        makePoint(37.772, -122.41, Number.NaN, 5), // NaN
        makePoint(37.773, -122.41, Number.POSITIVE_INFINITY, 5), // Infinity
        makePoint(37.774, -122.41, MIN_PLAUSIBLE_ALTITUDE_METERS - 1, 5), // < -500
        makePoint(37.775, -122.41, MAX_PLAUSIBLE_ALTITUDE_METERS + 1, 5), // > 9000
        makePoint(37.776, -122.41, 150, 51), // accuracy > 50m
        makePoint(91.0, -122.41, 150, 5), // lat > 90
        makePoint(-91.0, -122.41, 150, 5), // lat < -90
        makePoint(37.776, 181.0, 150, 5), // lon > 180
        makePoint(37.776, -181.0, 150, 5), // lon < -180
        makePoint(37.777, -122.41, 120, null), // null accuracy allowed
      ];

      const profile = computeAltitudeProfile(points, 'metric');
      expect(profile).not.toBeNull();
      // Only point 0 (lat 37.770) and point 7 (lat 37.777) survive
      expect(profile?.segments[0]).toHaveLength(2);
    });

    it('returns null if fewer than 2 valid points survive filtering', () => {
      const points: RoutePoint[] = [
        makePoint(37.77, -122.41, 100, 5),
        makePoint(37.771, -122.41, null, 5),
        makePoint(37.772, -122.41, 150, 60),
      ];
      expect(computeAltitudeProfile(points, 'metric')).toBeNull();
    });

    it('flat route with synthetic GPS jitter produces ~0m gain and loss with smoothing and threshold', () => {
      // 20 points alternating ±3m jitter on flat terrain
      const points: RoutePoint[] = Array.from({ length: 20 }, (_, i) =>
        makePoint(
          37.77 + i * 0.001,
          -122.41,
          100 + (i % 2 === 0 ? 3 : -3),
          5,
          1700000000000 + i * 2000,
        ),
      );

      const profile = computeAltitudeProfile(points, 'metric');
      expect(profile).not.toBeNull();
      // Raw jitter would accumulate ~57m of gain across 19 transitions.
      // Smoothing and threshold damp this down to ~0m.
      expect(profile!.gain).toBeLessThanOrEqual(15);
      expect(profile!.loss).toBeLessThanOrEqual(15);
    });

    it('flat route with ±2m GPS jitter produces ~0m gain and loss', () => {
      const points: RoutePoint[] = Array.from({ length: 20 }, (_, i) =>
        makePoint(
          37.77 + i * 0.001,
          -122.41,
          100 + (i % 2 === 0 ? 2 : -2),
          5,
          1700000000000 + i * 2000,
        ),
      );

      const profile = computeAltitudeProfile(points, 'metric');
      expect(profile).not.toBeNull();
      expect(profile!.gain).toBeLessThanOrEqual(2);
      expect(profile!.loss).toBeLessThanOrEqual(2);
    });

    it('continuous climb (+100m total ascent) accurately captures ~100m gain', () => {
      // 51 points stepping by 2m from 0m to 100m
      const points: RoutePoint[] = Array.from({ length: 51 }, (_, i) =>
        makePoint(
          37.77 + i * 0.001,
          -122.41,
          i * 2, // 0, 2, 4, ..., 100
          5,
          1700000000000 + i * 2000,
        ),
      );

      const profile = computeAltitudeProfile(points, 'metric');
      expect(profile).not.toBeNull();
      expect(profile!.gain).toBeGreaterThanOrEqual(95);
      expect(profile!.gain).toBeLessThanOrEqual(100);
      expect(profile!.loss).toBe(0);
      expect(profile!.elevationUnit).toBe('m');
      expect(profile!.distanceUnit).toBe('km');
      expect(profile!.minAltitude).toBe(profile!.segments[0]![0]!.y);
      expect(profile!.maxAltitude).toBe(
        profile!.segments[0]![profile!.segments[0]!.length - 1]!.y,
      );
    });

    it('handles metric vs imperial unit conversion correctly', () => {
      // Points stepping 2m each over distance
      const points: RoutePoint[] = Array.from({ length: 21 }, (_, i) =>
        makePoint(
          37.77 + i * 0.001,
          -122.41,
          100 + i * 2,
          5,
          1700000000000 + i * 2000,
        ),
      );

      const metric = computeAltitudeProfile(points, 'metric');
      const imperial = computeAltitudeProfile(points, 'imperial');

      expect(metric).not.toBeNull();
      expect(imperial).not.toBeNull();

      expect(metric!.elevationUnit).toBe('m');
      expect(metric!.distanceUnit).toBe('km');
      expect(imperial!.elevationUnit).toBe('ft');
      expect(imperial!.distanceUnit).toBe('mi');

      // 1 meter ≈ 3.28084 feet
      expect(imperial!.gain).toBe(Math.round(metric!.gain / 0.3048));
      expect(imperial!.totalDistance).toBeCloseTo(
        (metric!.totalDistance * 1000) / 1609.344,
        2,
      );

      // Check xTicks labels
      expect(metric!.xTicks).toHaveLength(5);
      expect(metric!.xTicks[0]!.label).toContain('km');
      expect(imperial!.xTicks).toHaveLength(5);
      expect(imperial!.xTicks[0]!.label).toContain('mi');
    });

    it('downsamples segments with large route point arrays (> 500 points)', () => {
      const points: RoutePoint[] = Array.from({ length: 600 }, (_, i) =>
        makePoint(
          37.77 + i * 0.0001,
          -122.41 + i * 0.0001,
          100 + Math.sin(i / 10) * 20,
          5,
          1700000000000 + i * 2000,
        ),
      );

      const profile = computeAltitudeProfile(points, 'metric');
      expect(profile).not.toBeNull();
      const totalRenderedPoints = profile!.segments.reduce(
        (sum, seg) => sum + seg.length,
        0,
      );
      expect(totalRenderedPoints).toBeLessThanOrEqual(
        ALTITUDE_CHART_MAX_POINTS,
      );
    });
  });
});
