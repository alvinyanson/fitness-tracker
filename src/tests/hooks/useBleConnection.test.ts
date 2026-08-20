import { act, renderHook } from '@testing-library/react-native';
import { useBleConnection } from '@/hooks/useBleConnection';
import { getBleService, resetBleService } from '@/services/ble/bleService';

describe('useBleConnection', () => {
  beforeEach(() => {
    resetBleService();
  });

  afterEach(() => {
    resetBleService();
  });

  it('returns idle snapshot initially', async () => {
    const { result } = await renderHook(() => useBleConnection());
    expect(result.current).toEqual({ state: 'idle' });
  });

  it('updates when BLE service emits a new snapshot', async () => {
    const { result } = await renderHook(() => useBleConnection());
    expect(result.current.state).toBe('idle');

    const service = getBleService();
    await act(async () => {
      service.startScan(jest.fn());
    });

    expect(result.current.state).toBe('scanning');

    await act(async () => {
      service.stopScan();
    });

    expect(result.current.state).toBe('idle');
  });
});
