import { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FormattedMeasurement,
  UnitLabels,
  UnitSystem,
} from '@/interfaces/units';
import {
  formatDistance,
  formatElevation,
  formatPace,
  formatSpeed,
  formatWeight,
  type MeasurementFormatContext,
} from '@/services/units/formatMeasurement';
import { useSettingsStore } from '@/store/settingsStore';

export function useUnitFormat(): {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  formatDistance: (meters: number) => FormattedMeasurement;
  formatWeight: (kilograms: number) => FormattedMeasurement;
  formatElevation: (meters: number) => FormattedMeasurement;
  formatSpeed: (mps: number) => FormattedMeasurement;
  formatPace: (mps: number) => FormattedMeasurement;
} {
  const unitSystem = useSettingsStore((state) => state.units);
  const setUnitSystem = useSettingsStore((state) => state.setUnits);
  const { t, language } = useTranslation();

  const context = useMemo<MeasurementFormatContext>(() => {
    const labels: UnitLabels = {
      kilometers: t('units.kilometers'),
      miles: t('units.miles'),
      meters: t('units.meters'),
      feet: t('units.feet'),
      kilograms: t('units.kilograms'),
      pounds: t('units.pounds'),
      kilometersPerHour: t('units.kilometersPerHour'),
      milesPerHour: t('units.milesPerHour'),
      perKilometer: t('units.perKilometer'),
      perMile: t('units.perMile'),
    };
    return { unitSystem, locale: language, labels };
  }, [unitSystem, language, t]);

  return useMemo(
    () => ({
      unitSystem,
      setUnitSystem,
      formatDistance: (meters: number) => formatDistance(meters, context),
      formatWeight: (kilograms: number) => formatWeight(kilograms, context),
      formatElevation: (meters: number) => formatElevation(meters, context),
      formatSpeed: (mps: number) => formatSpeed(mps, context),
      formatPace: (mps: number) => formatPace(mps, context),
    }),
    [context, unitSystem, setUnitSystem],
  );
}
