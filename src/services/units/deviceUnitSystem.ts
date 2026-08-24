import { getLocales } from 'expo-localization';
import { DEFAULT_UNIT_SYSTEM, UnitSystem } from '@/interfaces/units';

export function getDeviceUnitSystem(): UnitSystem {
  const measurementSystem = getLocales()[0]?.measurementSystem;

  // 'uk' is mixed in practice; the distance-facing convention wins here.
  if (measurementSystem === 'us' || measurementSystem === 'uk') {
    return 'imperial';
  }
  if (measurementSystem === 'metric') {
    return 'metric';
  }
  return DEFAULT_UNIT_SYSTEM;
}
