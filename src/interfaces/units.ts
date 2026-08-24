export type UnitSystem = 'metric' | 'imperial';

export const SUPPORTED_UNIT_SYSTEMS = ['metric', 'imperial'] as const;

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

// A formatted magnitude, split so callers can style number and unit separately.
export interface FormattedMeasurement {
  value: string;
  unit: string;
}

// Resolved unit labels, injected into the service so it never calls t() itself.
export interface UnitLabels {
  kilometers: string;
  miles: string;
  meters: string;
  feet: string;
  kilograms: string;
  pounds: string;
  kilometersPerHour: string;
  milesPerHour: string;
  perKilometer: string;
  perMile: string;
}
