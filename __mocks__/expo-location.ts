import type { LocationObject, LocationSubscription } from 'expo-location';

declare module 'expo-location' {
  export function __setPermissionStatus(status: 'granted' | 'denied'): void;
  export function __emitLocation(location: LocationObject): void;
  export function __emitError(error: string): void;
  export function __getActiveWatcherCount(): number;
  export function __resetMocks(): void;
}

export enum LocationAccuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export const Accuracy = LocationAccuracy;

export type { LocationObject, LocationSubscription };

let permissionStatus: 'granted' | 'denied' = 'granted';
let currentWatchId = 0;
const watchers = new Map<
  number,
  {
    callback: (location: LocationObject) => void;
    errorHandler?: (error: string) => void;
  }
>();

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: permissionStatus,
  granted: permissionStatus === 'granted',
  canAskAgain: true,
  expires: 'never' as const,
}));

export const getForegroundPermissionsAsync = jest.fn(async () => ({
  status: permissionStatus,
  granted: permissionStatus === 'granted',
  canAskAgain: true,
  expires: 'never' as const,
}));

export const watchPositionAsync = jest.fn(
  async (
    options: {
      accuracy?: LocationAccuracy;
      timeInterval?: number;
      distanceInterval?: number;
    },
    callback: (location: LocationObject) => void,
    errorHandler?: (error: string) => void,
  ): Promise<LocationSubscription> => {
    const id = ++currentWatchId;
    watchers.set(id, { callback, errorHandler });

    return {
      remove: jest.fn(() => {
        watchers.delete(id);
      }),
    };
  },
);

export function __setPermissionStatus(status: 'granted' | 'denied'): void {
  permissionStatus = status;
}

export function __emitLocation(location: LocationObject): void {
  for (const watcher of watchers.values()) {
    watcher.callback(location);
  }
}

export function __emitError(error: string): void {
  for (const watcher of watchers.values()) {
    watcher.errorHandler?.(error);
  }
}

export function __getActiveWatcherCount(): number {
  return watchers.size;
}

export function __resetMocks(): void {
  permissionStatus = 'granted';
  watchers.clear();
  currentWatchId = 0;
  requestForegroundPermissionsAsync.mockClear();
  getForegroundPermissionsAsync.mockClear();
  watchPositionAsync.mockClear();
}
