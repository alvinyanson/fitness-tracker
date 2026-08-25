import { useNetworkStore } from '@/store/networkStore';

describe('networkStore', () => {
  beforeEach(() => {
    useNetworkStore.setState({ status: 'unknown' });
  });

  it('defaults to unknown', () => {
    expect(useNetworkStore.getState().status).toBe('unknown');
  });

  it('setStatus commits the given status', () => {
    useNetworkStore.getState().setStatus('offline');
    expect(useNetworkStore.getState().status).toBe('offline');

    useNetworkStore.getState().setStatus('online');
    expect(useNetworkStore.getState().status).toBe('online');

    useNetworkStore.getState().setStatus('unknown');
    expect(useNetworkStore.getState().status).toBe('unknown');
  });
});
