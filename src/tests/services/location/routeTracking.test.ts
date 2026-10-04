import {
  __emitError,
  __emitLocation,
  __getActiveWatcherCount,
  __resetMocks,
  __setPermissionStatus,
  LocationAccuracy,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
} from 'expo-location';
import type { RoutePoint } from '@/interfaces/location';
import * as crashService from '@/services/crashService';
import {
  requestLocationPermission,
  startRouteTracking,
} from '@/services/location/routeTracking';

describe('routeTracking', () => {
  let reportErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetMocks();
    jest.clearAllMocks();
    reportErrorSpy = jest.spyOn(crashService, 'reportError');
  });

  afterEach(() => {
    reportErrorSpy.mockRestore();
  });

  describe('requestLocationPermission', () => {
    it('returns true when permission is granted', async () => {
      __setPermissionStatus('granted');
      const granted = await requestLocationPermission();
      expect(granted).toBe(true);
      expect(requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('returns false when permission is denied', async () => {
      __setPermissionStatus('denied');
      const granted = await requestLocationPermission();
      expect(granted).toBe(false);
    });

    it('returns false and reports error when permission request throws', async () => {
      (requestForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Permission service unavailable'),
      );

      const granted = await requestLocationPermission();
      expect(granted).toBe(false);
      expect(reportErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          scope: 'routeTracking.requestLocationPermission',
        }),
      );
    });
  });

  describe('startRouteTracking', () => {
    it('starts watchPositionAsync with high accuracy and 2s / 5m intervals when permission is granted', async () => {
      __setPermissionStatus('granted');
      const onPoint = jest.fn();

      const unsubscribe = await startRouteTracking(onPoint);

      expect(watchPositionAsync).toHaveBeenCalledWith(
        {
          accuracy: LocationAccuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        expect.any(Function),
        expect.any(Function),
      );
      expect(__getActiveWatcherCount()).toBe(1);

      // Unsubscribe removes the watcher
      unsubscribe();
      expect(__getActiveWatcherCount()).toBe(0);
    });

    it('maps incoming LocationObject to RoutePoint accurately', async () => {
      __setPermissionStatus('granted');
      const points: RoutePoint[] = [];

      const unsubscribe = await startRouteTracking((p) => points.push(p));

      __emitLocation({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 15.5,
          accuracy: 8.2,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1_700_000_000_000,
      });

      expect(points).toEqual([
        {
          timestamp: 1_700_000_000_000,
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 15.5,
          accuracy: 8.2,
        },
      ]);

      unsubscribe();
    });

    it('handles null altitude and accuracy gracefully', async () => {
      __setPermissionStatus('granted');
      const points: RoutePoint[] = [];

      const unsubscribe = await startRouteTracking((p) => points.push(p));

      __emitLocation({
        coords: {
          latitude: 0,
          longitude: 0,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1_700_000_005_000,
      });

      expect(points[0]).toEqual({
        timestamp: 1_700_000_005_000,
        latitude: 0,
        longitude: 0,
        altitude: null,
        accuracy: null,
      });

      unsubscribe();
    });

    it('returns a no-op unsubscribe without watching position if permission is denied', async () => {
      __setPermissionStatus('denied');
      const onPoint = jest.fn();

      const unsubscribe = await startRouteTracking(onPoint);

      expect(watchPositionAsync).not.toHaveBeenCalled();
      expect(__getActiveWatcherCount()).toBe(0);

      expect(() => unsubscribe()).not.toThrow();
    });

    it('handles watchPositionAsync rejection reporting through crashService', async () => {
      __setPermissionStatus('granted');
      (watchPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Location provider disabled'),
      );
      const onError = jest.fn();

      const unsubscribe = await startRouteTracking(jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(reportErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          scope: 'routeTracking.startRouteTracking',
        }),
      );
      expect(() => unsubscribe()).not.toThrow();
    });

    it('forwards error callback from watcher to onError and crashService', async () => {
      __setPermissionStatus('granted');
      const onError = jest.fn();

      const unsubscribe = await startRouteTracking(jest.fn(), onError);

      __emitError('GPS signal lost');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(reportErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          scope: 'routeTracking.watcher',
        }),
      );

      unsubscribe();
    });

    it('reports error if onPoint callback throws', async () => {
      __setPermissionStatus('granted');
      const onError = jest.fn();
      const faultyOnPoint = jest.fn(() => {
        throw new Error('Callback crash');
      });

      const unsubscribe = await startRouteTracking(faultyOnPoint, onError);

      __emitLocation({
        coords: {
          latitude: 1,
          longitude: 1,
          altitude: null,
          accuracy: 5,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 12345,
      });

      expect(reportErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          scope: 'routeTracking.onPoint',
        }),
      );
      expect(onError).toHaveBeenCalled();

      unsubscribe();
    });
  });
});
