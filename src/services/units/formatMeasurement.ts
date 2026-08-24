import { LocaleCode } from '@/interfaces/i18n';
import {
  FormattedMeasurement,
  UnitLabels,
  UnitSystem,
} from '@/interfaces/units';
import { formatDuration } from '@/services/formatDuration';
import { formatNumber } from '@/utils/formatNumber';
import {
  kilogramsToPounds,
  metersPerSecondToKmh,
  metersPerSecondToMph,
  metersPerSecondToSecondsPerKilometer,
  metersPerSecondToSecondsPerMile,
  metersToFeet,
  metersToKilometers,
  metersToMiles,
} from '@/utils/unitConversion';

export interface MeasurementFormatContext {
  unitSystem: UnitSystem;
  locale: LocaleCode;
  labels: UnitLabels;
}

const PLACEHOLDER = '—';

function isRenderable(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function format(
  input: number,
  ctx: MeasurementFormatContext,
  convert: (value: number) => number,
  unit: string,
  fractionDigits: number,
): FormattedMeasurement {
  if (!isRenderable(input)) {
    return { value: PLACEHOLDER, unit };
  }

  const converted = convert(input);
  if (!isRenderable(converted)) {
    return { value: PLACEHOLDER, unit };
  }

  return {
    value: formatNumber(converted, ctx.locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }),
    unit,
  };
}

export function formatDistance(
  meters: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement {
  const metric = ctx.unitSystem === 'metric';
  return format(
    meters,
    ctx,
    metric ? metersToKilometers : metersToMiles,
    metric ? ctx.labels.kilometers : ctx.labels.miles,
    1,
  );
}

export function formatWeight(
  kilograms: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement {
  const metric = ctx.unitSystem === 'metric';
  return format(
    kilograms,
    ctx,
    metric ? (value) => value : kilogramsToPounds,
    metric ? ctx.labels.kilograms : ctx.labels.pounds,
    1,
  );
}

export function formatElevation(
  meters: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement {
  const metric = ctx.unitSystem === 'metric';
  return format(
    meters,
    ctx,
    metric ? (value) => value : metersToFeet,
    metric ? ctx.labels.meters : ctx.labels.feet,
    0,
  );
}

export function formatSpeed(
  mps: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement {
  const metric = ctx.unitSystem === 'metric';
  return format(
    mps,
    ctx,
    metric ? metersPerSecondToKmh : metersPerSecondToMph,
    metric ? ctx.labels.kilometersPerHour : ctx.labels.milesPerHour,
    1,
  );
}

export function formatPace(
  mps: number,
  ctx: MeasurementFormatContext,
): FormattedMeasurement {
  const metric = ctx.unitSystem === 'metric';
  const unit = metric ? ctx.labels.perKilometer : ctx.labels.perMile;

  if (!isRenderable(mps) || mps === 0) {
    return { value: PLACEHOLDER, unit };
  }

  const seconds = metric
    ? metersPerSecondToSecondsPerKilometer(mps)
    : metersPerSecondToSecondsPerMile(mps);

  if (!isRenderable(seconds)) {
    return { value: PLACEHOLDER, unit };
  }

  return { value: formatDuration(seconds), unit };
}
