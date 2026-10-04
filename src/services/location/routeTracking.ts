import {
  LocationAccuracy,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
  type LocationObject,
  type LocationSubscription,
} from 'expo-location';
import type { RoutePoint } from '@/interfaces/location';
import { reportError } from '@/services/crashService';

/** Requests foreground location permission from expo-location. Returns true if granted. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const response = await requestForegroundPermissionsAsync();
    return response.status === 'granted';
  } catch (error) {
    reportError(error, { scope: 'routeTracking.requestLocationPermission' });
    return false;
  }
}

/**
 * Starts expo-location watchPositionAsync while active.
 * Uses LocationAccuracy.High, timeInterval: 2000ms, distanceInterval: 5m.
 * Returns an unsubscribe callback.
 */
export async function startRouteTracking(
  onPoint: (point: RoutePoint) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return () => {};
    }

    const subscription: LocationSubscription = await watchPositionAsync(
      {
        accuracy: LocationAccuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (location: LocationObject) => {
        try {
          const point: RoutePoint = {
            timestamp: location.timestamp,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude ?? null,
            accuracy: location.coords.accuracy ?? null,
          };
          onPoint(point);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          reportError(error, { scope: 'routeTracking.onPoint' });
          onError?.(error);
        }
      },
      (errorMessage: string) => {
        const error = new Error(errorMessage);
        reportError(error, { scope: 'routeTracking.watcher' });
        onError?.(error);
      },
    );

    return () => {
      try {
        subscription.remove();
      } catch (err) {
        reportError(err, { scope: 'routeTracking.unsubscribe' });
      }
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reportError(err, { scope: 'routeTracking.startRouteTracking' });
    onError?.(err);
    return () => {};
  }
}
