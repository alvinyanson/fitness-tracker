import type { ChartDomain, ChartSegment, ChartTick } from './chart';

/** One raw or filtered GPS route point. */
export interface RoutePoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}

/** Elevation gain and loss totals in meters. */
export interface ElevationGainLoss {
  gainMeters: number;
  lossMeters: number;
}

/** Derived altitude profile data ready for chart presentation. */
export interface AltitudeProfileData {
  segments: ChartSegment[];
  domain: ChartDomain;
  xTicks: ChartTick[];
  gain: number;
  loss: number;
  elevationUnit: 'm' | 'ft';
  distanceUnit: 'km' | 'mi';
  totalDistance: number;
  minAltitude: number;
  maxAltitude: number;
}
