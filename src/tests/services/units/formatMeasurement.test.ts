import { LocaleCode } from '@/interfaces/i18n';
import { UnitLabels, UnitSystem } from '@/interfaces/units';
import {
  formatDistance,
  formatElevation,
  formatPace,
  formatSpeed,
  formatWeight,
  type MeasurementFormatContext,
} from '@/services/units/formatMeasurement';

const labels: UnitLabels = {
  kilometers: 'km',
  miles: 'mi',
  meters: 'm',
  feet: 'ft',
  kilograms: 'kg',
  pounds: 'lb',
  kilometersPerHour: 'km/h',
  milesPerHour: 'mph',
  perKilometer: '/km',
  perMile: '/mi',
};

function ctx(
  unitSystem: UnitSystem,
  locale: LocaleCode = 'en',
): MeasurementFormatContext {
  return { unitSystem, locale, labels };
}

describe('formatMeasurement', () => {
  describe('formatDistance', () => {
    it('renders kilometres with one fraction digit in metric', () => {
      expect(formatDistance(5000, ctx('metric'))).toEqual({
        value: '5.0',
        unit: 'km',
      });
    });

    it('renders miles with one fraction digit in imperial', () => {
      expect(formatDistance(5000, ctx('imperial'))).toEqual({
        value: '3.1',
        unit: 'mi',
      });
    });

    it('formats for the ja locale', () => {
      expect(formatDistance(5000, ctx('metric', 'ja'))).toEqual({
        value: '5.0',
        unit: 'km',
      });
    });

    it('renders zero', () => {
      expect(formatDistance(0, ctx('metric'))).toEqual({
        value: '0.0',
        unit: 'km',
      });
    });

    it('renders the placeholder for negative and non-finite input', () => {
      expect(formatDistance(-100, ctx('metric'))).toEqual({
        value: '—',
        unit: 'km',
      });
      expect(formatDistance(NaN, ctx('imperial'))).toEqual({
        value: '—',
        unit: 'mi',
      });
      expect(formatDistance(Infinity, ctx('metric'))).toEqual({
        value: '—',
        unit: 'km',
      });
    });
  });

  describe('formatWeight', () => {
    it('renders kilograms in metric and pounds in imperial', () => {
      expect(formatWeight(70, ctx('metric'))).toEqual({
        value: '70.0',
        unit: 'kg',
      });
      expect(formatWeight(70, ctx('imperial'))).toEqual({
        value: '154.3',
        unit: 'lb',
      });
    });

    it('formats for the ja locale', () => {
      expect(formatWeight(70, ctx('metric', 'ja'))).toEqual({
        value: '70.0',
        unit: 'kg',
      });
    });

    it('renders the placeholder for negative and non-finite input', () => {
      expect(formatWeight(-1, ctx('metric')).value).toBe('—');
      expect(formatWeight(NaN, ctx('imperial')).value).toBe('—');
    });
  });

  describe('formatElevation', () => {
    it('renders metres and feet with no fraction digits', () => {
      expect(formatElevation(123.4, ctx('metric'))).toEqual({
        value: '123',
        unit: 'm',
      });
      expect(formatElevation(100, ctx('imperial'))).toEqual({
        value: '328',
        unit: 'ft',
      });
    });

    it('formats for the ja locale', () => {
      expect(formatElevation(1234, ctx('metric', 'ja'))).toEqual({
        value: '1,234',
        unit: 'm',
      });
    });

    it('renders the placeholder for negative and non-finite input', () => {
      expect(formatElevation(-5, ctx('metric')).value).toBe('—');
      expect(formatElevation(-Infinity, ctx('imperial')).value).toBe('—');
    });
  });

  describe('formatSpeed', () => {
    it('renders km/h in metric and mph in imperial', () => {
      expect(formatSpeed(5, ctx('metric'))).toEqual({
        value: '18.0',
        unit: 'km/h',
      });
      expect(formatSpeed(5, ctx('imperial'))).toEqual({
        value: '11.2',
        unit: 'mph',
      });
    });

    it('formats for the ja locale', () => {
      expect(formatSpeed(5, ctx('metric', 'ja'))).toEqual({
        value: '18.0',
        unit: 'km/h',
      });
    });

    it('renders zero and rejects negative or non-finite input', () => {
      expect(formatSpeed(0, ctx('metric'))).toEqual({
        value: '0.0',
        unit: 'km/h',
      });
      expect(formatSpeed(-1, ctx('metric')).value).toBe('—');
      expect(formatSpeed(NaN, ctx('metric')).value).toBe('—');
    });
  });

  describe('formatPace', () => {
    it('renders mm:ss per kilometre in metric', () => {
      // 1000 m / 312 s ≈ 3.2051 m/s → 05:12 /km
      expect(formatPace(1000 / 312, ctx('metric'))).toEqual({
        value: '05:12',
        unit: '/km',
      });
    });

    it('renders mm:ss per mile in imperial', () => {
      expect(formatPace(1609.344 / 480, ctx('imperial'))).toEqual({
        value: '08:00',
        unit: '/mi',
      });
    });

    it('formats for the ja locale identically', () => {
      expect(formatPace(1000 / 312, ctx('metric', 'ja'))).toEqual({
        value: '05:12',
        unit: '/km',
      });
    });

    it('renders the placeholder for zero, negative and non-finite input', () => {
      expect(formatPace(0, ctx('metric'))).toEqual({
        value: '—',
        unit: '/km',
      });
      expect(formatPace(-1, ctx('imperial'))).toEqual({
        value: '—',
        unit: '/mi',
      });
      expect(formatPace(NaN, ctx('metric')).value).toBe('—');
      expect(formatPace(Infinity, ctx('metric')).value).toBe('—');
    });
  });
});
