/** One raw or filtered GPS route point. */
export interface RoutePoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}
