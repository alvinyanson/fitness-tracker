import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import {
  useHealthConnectAvailability,
  HEALTH_CONNECT_MARKET_URI,
  HEALTH_CONNECT_PLAY_STORE_URL,
} from '@/hooks/useHealthConnectAvailability';
import * as availabilityService from '@/services/healthConnect/healthConnectAvailability';
import * as permissionsService from '@/services/healthConnect/healthConnectPermissions';
import type { Permission } from 'react-native-health-connect';

jest.mock('@/services/healthConnect/healthConnectAvailability');
jest.mock('@/services/healthConnect/healthConnectPermissions');

describe('useHealthConnectAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockResolvedValue('available');
  });

  it('mounts into checking then resolves availability', async () => {
    let resolveAvailability!: (val: 'available') => void;
    const availabilityPromise = new Promise<'available'>((res) => {
      resolveAvailability = res;
    });
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockReturnValue(availabilityPromise);

    const { result } = await renderHook(() => useHealthConnectAvailability());

    expect(result.current.availability).toBe('checking');

    await act(async () => {
      resolveAvailability('available');
    });

    await waitFor(() => {
      expect(result.current.availability).toBe('available');
    });
  });

  it('retry re-enters checking and resolves new status', async () => {
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockResolvedValue('needs-install');

    const { result } = await renderHook(() => useHealthConnectAvailability());

    await waitFor(() => {
      expect(result.current.availability).toBe('needs-install');
    });

    let resolveRetry!: (val: 'available') => void;
    const retryPromise = new Promise<'available'>((res) => {
      resolveRetry = res;
    });
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockReturnValue(retryPromise);

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.availability).toBe('checking');

    await act(async () => {
      resolveRetry('available');
    });

    await waitFor(() => {
      expect(result.current.availability).toBe('available');
    });
  });

  it('requestPermissions delegates to requestHealthConnectPermissions', async () => {
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockResolvedValue('available');
    (
      permissionsService.requestHealthConnectPermissions as jest.Mock
    ).mockResolvedValue('granted');

    const { result } = await renderHook(() => useHealthConnectAvailability());

    await waitFor(() => {
      expect(result.current.availability).toBe('available');
    });

    const permissions: Permission[] = [
      { accessType: 'read', recordType: 'ExerciseSession' },
    ];
    let status;
    await act(async () => {
      status = await result.current.requestPermissions(permissions);
    });

    expect(status).toBe('granted');
    expect(
      permissionsService.requestHealthConnectPermissions,
    ).toHaveBeenCalledWith(permissions);
  });

  it('openPlayStoreListing opens market URI when canOpenURL is true', async () => {
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockResolvedValue('needs-install');
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURLSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);

    const { result } = await renderHook(() => useHealthConnectAvailability());

    await waitFor(() => {
      expect(result.current.availability).toBe('needs-install');
    });

    await act(async () => {
      await result.current.openPlayStoreListing();
    });

    expect(Linking.canOpenURL).toHaveBeenCalledWith(HEALTH_CONNECT_MARKET_URI);
    expect(openURLSpy).toHaveBeenCalledWith(HEALTH_CONNECT_MARKET_URI);
  });

  it('openPlayStoreListing falls back to web URL when canOpenURL is false', async () => {
    (
      availabilityService.getHealthConnectAvailability as jest.Mock
    ).mockResolvedValue('needs-install');
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const openURLSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);

    const { result } = await renderHook(() => useHealthConnectAvailability());

    await waitFor(() => {
      expect(result.current.availability).toBe('needs-install');
    });

    await act(async () => {
      await result.current.openPlayStoreListing();
    });

    expect(Linking.canOpenURL).toHaveBeenCalledWith(HEALTH_CONNECT_MARKET_URI);
    expect(openURLSpy).toHaveBeenCalledWith(HEALTH_CONNECT_PLAY_STORE_URL);
  });
});
