export const METERS_PER_KILOMETER = 1000;
export const METERS_PER_MILE = 1609.344;
export const METERS_PER_FOOT = 0.3048;
export const POUNDS_PER_KILOGRAM = 2.20462262185;
export const SECONDS_PER_HOUR = 3600;

export function metersToKilometers(meters: number): number {
  return meters / METERS_PER_KILOMETER;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function metersToFeet(meters: number): number {
  return meters / METERS_PER_FOOT;
}

export function kilogramsToPounds(kilograms: number): number {
  return kilograms * POUNDS_PER_KILOGRAM;
}

export function metersPerSecondToKmh(mps: number): number {
  return (mps * SECONDS_PER_HOUR) / METERS_PER_KILOMETER;
}

export function metersPerSecondToMph(mps: number): number {
  return (mps * SECONDS_PER_HOUR) / METERS_PER_MILE;
}

export function metersPerSecondToSecondsPerKilometer(mps: number): number {
  return METERS_PER_KILOMETER / mps;
}

export function metersPerSecondToSecondsPerMile(mps: number): number {
  return METERS_PER_MILE / mps;
}
