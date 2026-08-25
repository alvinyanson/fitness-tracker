import { create } from 'zustand';
import type { NetworkStatus } from '@/interfaces/network';

export interface NetworkState {
  status: NetworkStatus;
  setStatus: (status: NetworkStatus) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  status: 'unknown',
  setStatus: (status) => {
    set({ status });
  },
}));
