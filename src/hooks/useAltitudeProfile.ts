import { useMemo } from 'react';
import type { AltitudeProfileData, RoutePoint } from '@/interfaces/location';
import { computeAltitudeProfile } from '@/services/location/altitudeProfile';
import { useSettingsStore } from '@/store/settingsStore';

export function useAltitudeProfile(
  routePoints: RoutePoint[],
): AltitudeProfileData | null {
  const unitSystem = useSettingsStore((state) => state.units);

  return useMemo(
    () => computeAltitudeProfile(routePoints, unitSystem),
    [routePoints, unitSystem],
  );
}
