import {
  METERS_PER_FOOT,
  METERS_PER_MILE,
  POUNDS_PER_KILOGRAM,
  kilogramsToPounds,
  metersPerSecondToKmh,
  metersPerSecondToMph,
  metersPerSecondToSecondsPerKilometer,
  metersPerSecondToSecondsPerMile,
  metersToFeet,
  metersToKilometers,
  metersToMiles,
} from '@/utils/unitConversion';

describe('unitConversion', () => {
  describe('metersToKilometers', () => {
    it('converts known values', () => {
      expect(metersToKilometers(1000)).toBe(1);
      expect(metersToKilometers(5000)).toBe(5);
    });

    it('handles zero and negative input', () => {
      expect(metersToKilometers(0)).toBe(0);
      expect(metersToKilometers(-1000)).toBe(-1);
    });
  });

  describe('metersToMiles', () => {
    it('converts one mile of metres to 1', () => {
      expect(metersToMiles(METERS_PER_MILE)).toBe(1);
      expect(metersToMiles(5000)).toBeCloseTo(3.106856, 6);
    });

    it('handles zero and negative input', () => {
      expect(metersToMiles(0)).toBe(0);
      expect(metersToMiles(-METERS_PER_MILE)).toBe(-1);
    });
  });

  describe('metersToFeet', () => {
    it('converts one foot of metres to 1', () => {
      expect(metersToFeet(METERS_PER_FOOT)).toBeCloseTo(1, 10);
      expect(metersToFeet(100)).toBeCloseTo(328.0839895, 6);
    });

    it('handles zero and negative input', () => {
      expect(metersToFeet(0)).toBe(0);
      expect(metersToFeet(-METERS_PER_FOOT)).toBeCloseTo(-1, 10);
    });
  });

  describe('kilogramsToPounds', () => {
    it('converts known values', () => {
      expect(kilogramsToPounds(1)).toBe(POUNDS_PER_KILOGRAM);
      expect(kilogramsToPounds(70)).toBeCloseTo(154.3235835, 6);
    });

    it('handles zero and negative input', () => {
      expect(kilogramsToPounds(0)).toBe(0);
      expect(kilogramsToPounds(-1)).toBe(-POUNDS_PER_KILOGRAM);
    });
  });

  describe('speed conversions', () => {
    it('converts 1 m/s to 3.6 km/h', () => {
      expect(metersPerSecondToKmh(1)).toBeCloseTo(3.6, 10);
    });

    it('converts 1 m/s to 2.2369 mph', () => {
      expect(metersPerSecondToMph(1)).toBeCloseTo(2.2369363, 6);
    });

    it('handles zero and negative input', () => {
      expect(metersPerSecondToKmh(0)).toBe(0);
      expect(metersPerSecondToMph(0)).toBe(0);
      expect(metersPerSecondToKmh(-1)).toBeCloseTo(-3.6, 10);
    });
  });

  describe('pace conversions', () => {
    it('converts m/s to seconds per kilometre', () => {
      expect(metersPerSecondToSecondsPerKilometer(1)).toBe(1000);
      // 5:00/km
      expect(metersPerSecondToSecondsPerKilometer(1000 / 300)).toBeCloseTo(
        300,
        6,
      );
    });

    it('converts m/s to seconds per mile', () => {
      expect(metersPerSecondToSecondsPerMile(1)).toBe(METERS_PER_MILE);
    });

    it('propagates Infinity for a zero input', () => {
      expect(metersPerSecondToSecondsPerKilometer(0)).toBe(Infinity);
      expect(metersPerSecondToSecondsPerMile(0)).toBe(Infinity);
    });

    it('returns a negative pace for negative input', () => {
      expect(metersPerSecondToSecondsPerKilometer(-1)).toBe(-1000);
    });
  });
});
