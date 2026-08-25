/** Three states, per the project's explicit-union convention. */
export type NetworkStatus = 'unknown' | 'online' | 'offline';

export interface NetworkReachability {
  /** `NetInfoState.isConnected` — an interface exists. */
  isConnected: boolean;
  /** `NetInfoState.isInternetReachable` — `null` while the probe is in flight. */
  isInternetReachable: boolean | null;
}
