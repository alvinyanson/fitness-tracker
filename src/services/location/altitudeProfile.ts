import type { ChartPoint } from '@/interfaces/chart';
import type {
  AltitudeProfileData,
  ElevationGainLoss,
  RoutePoint,
} from '@/interfaces/location';
import type { UnitSystem } from '@/interfaces/units';
import {
  buildXTicks,
  computeDomain,
  downsampleSegments,
} from '@/services/chart/chartSeries';
import {
  haversineDistance,
  MAX_PLAUSIBLE_ACCURACY_METERS,
} from '@/services/location/distanceMath';
import {
  metersToFeet,
  metersToKilometers,
  metersToMiles,
} from '@/utils/unitConversion';

/** Window size for centered moving average smoothing (5 samples ≈ 10 seconds of movement at 2s GPS interval). */
export const ALTITUDE_SMOOTHING_WINDOW = 5;

/** Minimum elevation delta in meters required to accumulate gain or loss, filtering micro-jitter. */
export const MIN_ELEVATION_DELTA_METERS = 1.0;

/** Plausible altitude bounds in meters (Dead Sea to Everest). */
export const MIN_PLAUSIBLE_ALTITUDE_METERS = -500;
export const MAX_PLAUSIBLE_ALTITUDE_METERS = 9000;

/** Maximum points rendered on the SVG chart before downsampling. */
export const ALTITUDE_CHART_MAX_POINTS = 240;

/** Smooths an altitude array using a centered moving average of windowSize. */
export function smoothAltitude(
  altitudes: number[],
  windowSize = ALTITUDE_SMOOTHING_WINDOW,
): number[] {
  if (altitudes.length === 0) {
    return [];
  }
  if (windowSize <= 1) {
    return [...altitudes];
  }

  const halfWindow = Math.floor(windowSize / 2);
  const result: number[] = [];

  for (let i = 0; i < altitudes.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(altitudes.length - 1, i + halfWindow);
    let sum = 0;
    const count = end - start + 1;
    for (let j = start; j <= end; j++) {
      sum += altitudes[j]!;
    }
    result.push(sum / count);
  }

  return result;
}

/** Calculates cumulative elevation gain and loss from a smoothed altitude series. */
export function calculateElevationGainLoss(
  smoothedAltitudes: number[],
  minDeltaMeters = MIN_ELEVATION_DELTA_METERS,
): ElevationGainLoss {
  if (smoothedAltitudes.length < 2) {
    return { gainMeters: 0, lossMeters: 0 };
  }

  let gainMeters = 0;
  let lossMeters = 0;
  let anchor = smoothedAltitudes[0]!;
  let mode: 'flat' | 'up' | 'down' = 'flat';

  for (let i = 1; i < smoothedAltitudes.length; i++) {
    const current = smoothedAltitudes[i]!;

    if (mode === 'flat') {
      if (current - anchor >= minDeltaMeters) {
        mode = 'up';
        gainMeters += current - anchor;
        anchor = current;
      } else if (anchor - current >= minDeltaMeters) {
        mode = 'down';
        lossMeters += anchor - current;
        anchor = current;
      }
    } else if (mode === 'up') {
      if (current > anchor) {
        gainMeters += current - anchor;
        anchor = current;
      } else if (anchor - current >= minDeltaMeters) {
        mode = 'down';
        lossMeters += anchor - current;
        anchor = current;
      }
    } else if (mode === 'down') {
      if (current < anchor) {
        lossMeters += anchor - current;
        anchor = current;
      } else if (current - anchor >= minDeltaMeters) {
        mode = 'up';
        gainMeters += current - anchor;
        anchor = current;
      }
    }
  }

  return { gainMeters, lossMeters };
}

function isValidAltitudePoint(point: RoutePoint): boolean {
  if (!point) {
    return false;
  }
  if (point.altitude === null || point.altitude === undefined) {
    return false;
  }
  if (!Number.isFinite(point.altitude)) {
    return false;
  }
  if (
    point.altitude < MIN_PLAUSIBLE_ALTITUDE_METERS ||
    point.altitude > MAX_PLAUSIBLE_ALTITUDE_METERS
  ) {
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

/** Derives plottable chart segments, domain, ticks, and elevation gain/loss for a route. */
export function computeAltitudeProfile(
  routePoints: RoutePoint[],
  unitSystem: UnitSystem,
  options?: {
    smoothingWindow?: number;
    minDeltaMeters?: number;
    maxPoints?: number;
    xTickCount?: number;
  },
): AltitudeProfileData | null {
  if (!routePoints || routePoints.length < 2) {
    return null;
  }

  const validPoints = routePoints.filter(isValidAltitudePoint);
  if (validPoints.length < 2) {
    return null;
  }

  const distancesMeters: number[] = [0];
  let totalDistanceMeters = 0;

  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1]!;
    const curr = validPoints[i]!;
    const dist = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );
    totalDistanceMeters += dist;
    distancesMeters.push(totalDistanceMeters);
  }

  if (totalDistanceMeters <= 0) {
    return null;
  }

  const rawAltitudes = validPoints.map((p) => p.altitude as number);
  const smoothingWindow = options?.smoothingWindow ?? ALTITUDE_SMOOTHING_WINDOW;
  const smoothedAltitudes = smoothAltitude(rawAltitudes, smoothingWindow);

  const minDeltaMeters = options?.minDeltaMeters ?? MIN_ELEVATION_DELTA_METERS;
  const gainLoss = calculateElevationGainLoss(
    smoothedAltitudes,
    minDeltaMeters,
  );

  const isMetric = unitSystem === 'metric';
  const distanceUnit: 'km' | 'mi' = isMetric ? 'km' : 'mi';
  const elevationUnit: 'm' | 'ft' = isMetric ? 'm' : 'ft';

  const convertDistance = isMetric ? metersToKilometers : metersToMiles;
  const convertElevation = isMetric ? (m: number) => m : metersToFeet;

  const totalDistance = convertDistance(totalDistanceMeters);
  const gain = Math.round(convertElevation(gainLoss.gainMeters));
  const loss = Math.round(convertElevation(gainLoss.lossMeters));

  let minAltMeters = smoothedAltitudes[0]!;
  let maxAltMeters = smoothedAltitudes[0]!;
  for (let i = 1; i < smoothedAltitudes.length; i++) {
    const alt = smoothedAltitudes[i]!;
    if (alt < minAltMeters) minAltMeters = alt;
    if (alt > maxAltMeters) maxAltMeters = alt;
  }
  const minAltitude = Math.round(convertElevation(minAltMeters));
  const maxAltitude = Math.round(convertElevation(maxAltMeters));

  const points: ChartPoint[] = validPoints.map((_, i) => ({
    x: convertDistance(distancesMeters[i]!),
    y: convertElevation(smoothedAltitudes[i]!),
  }));

  const maxPoints = options?.maxPoints ?? ALTITUDE_CHART_MAX_POINTS;
  const segments = downsampleSegments([points], maxPoints);

  const domain = computeDomain(segments);
  if (domain === null) {
    return null;
  }

  const xTickCount = options?.xTickCount ?? 5;
  const xTicks = buildXTicks(domain, xTickCount, (val) => {
    const safeVal = Math.abs(val) < 1e-9 ? 0 : val;
    return `${safeVal.toFixed(1)} ${distanceUnit}`;
  });

  return {
    segments,
    domain,
    xTicks,
    gain,
    loss,
    elevationUnit,
    distanceUnit,
    totalDistance,
    minAltitude,
    maxAltitude,
  };
}
