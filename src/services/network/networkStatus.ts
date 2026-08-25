import type { NetworkReachability, NetworkStatus } from '@/interfaces/network';

/** Maps a NetInfo snapshot to a status. Reachability wins over interface presence. */
export function toNetworkStatus(state: NetworkReachability): NetworkStatus {
  if (!state.isConnected) {
    return 'offline';
  }
  if (state.isInternetReachable === null) {
    return 'unknown';
  }
  return state.isInternetReachable ? 'online' : 'offline';
}
