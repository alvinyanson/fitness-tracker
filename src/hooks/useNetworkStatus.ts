import type { NetworkStatus } from '@/interfaces/network';
import { useNetworkStore } from '@/store/networkStore';

export function useNetworkStatus(): {
  status: NetworkStatus;
  isOffline: boolean;
  isOnline: boolean;
} {
  const status = useNetworkStore((state) => state.status);

  return {
    status,
    isOffline: status === 'offline',
    isOnline: status === 'online',
  };
}
