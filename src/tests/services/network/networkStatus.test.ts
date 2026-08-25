import { toNetworkStatus } from '@/services/network/networkStatus';

describe('toNetworkStatus', () => {
  it('returns offline when no interface is connected, whatever reachability says', () => {
    expect(
      toNetworkStatus({ isConnected: false, isInternetReachable: true }),
    ).toBe('offline');
    expect(
      toNetworkStatus({ isConnected: false, isInternetReachable: false }),
    ).toBe('offline');
    expect(
      toNetworkStatus({ isConnected: false, isInternetReachable: null }),
    ).toBe('offline');
  });

  it('returns offline for a connected interface with no internet reachability', () => {
    expect(
      toNetworkStatus({ isConnected: true, isInternetReachable: false }),
    ).toBe('offline');
  });

  it('returns unknown while the reachability probe is in flight', () => {
    expect(
      toNetworkStatus({ isConnected: true, isInternetReachable: null }),
    ).toBe('unknown');
  });

  it('returns online only when the interface is connected and reachable', () => {
    expect(
      toNetworkStatus({ isConnected: true, isInternetReachable: true }),
    ).toBe('online');
  });
});
