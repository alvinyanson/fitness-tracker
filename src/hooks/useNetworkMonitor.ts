import { useEffect } from 'react';
import { addEventListener } from '@react-native-community/netinfo';
import { reportError } from '@/services/crashService';
import { toNetworkStatus } from '@/services/network/networkStatus';
import { useNetworkStore } from '@/store/networkStore';

/** Subscribes to NetInfo for the app's lifetime. Mounted once, at the app root. */
export function useNetworkMonitor(): void {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = addEventListener((state) => {
        useNetworkStore.getState().setStatus(
          toNetworkStatus({
            isConnected: state.isConnected === true,
            isInternetReachable: state.isInternetReachable,
          }),
        );
      });
    } catch (error) {
      reportError(error, { source: 'useNetworkMonitor.addEventListener' });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);
}
