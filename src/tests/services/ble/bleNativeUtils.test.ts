import type { BleManager, Subscription } from 'react-native-ble-plx';
import { reportError } from '@/services/crashService';
import {
  safeCancelDeviceConnection,
  safeDestroyManager,
  safeRemoveSubscription,
  safeStopScan,
} from '@/services/ble/bleNativeUtils';

jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

describe('bleNativeUtils', () => {
  let mockManager: BleManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockManager = {
      stopDeviceScan: jest.fn(),
      cancelDeviceConnection: jest.fn().mockResolvedValue({} as any),
      destroy: jest.fn(),
    } as unknown as BleManager;
  });

  describe('safeStopScan', () => {
    it('stops device scan without error', () => {
      safeStopScan(mockManager);
      expect(mockManager.stopDeviceScan).toHaveBeenCalledTimes(1);
      expect(reportError).not.toHaveBeenCalled();
    });

    it('catches and reports error when stopDeviceScan throws', () => {
      const error = new Error('Native scan stop failure');
      (mockManager.stopDeviceScan as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => safeStopScan(mockManager)).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(error, {
        scope: 'safeStopScan',
      });
    });
  });

  describe('safeCancelDeviceConnection', () => {
    it('cancels device connection without error', () => {
      safeCancelDeviceConnection(mockManager, 'dev-1');
      expect(mockManager.cancelDeviceConnection).toHaveBeenCalledWith('dev-1');
      expect(reportError).not.toHaveBeenCalled();
    });

    it('catches synchronous exception and reports error', () => {
      const error = new Error('Sync cancel failure');
      (mockManager.cancelDeviceConnection as jest.Mock).mockImplementation(
        () => {
          throw error;
        },
      );

      expect(() =>
        safeCancelDeviceConnection(mockManager, 'dev-1'),
      ).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(error, {
        scope: 'safeCancelDeviceConnection',
        deviceId: 'dev-1',
      });
    });

    it('catches asynchronous rejection and reports error', async () => {
      const error = new Error('Async cancel rejection');
      (mockManager.cancelDeviceConnection as jest.Mock).mockRejectedValue(
        error,
      );

      safeCancelDeviceConnection(mockManager, 'dev-1');
      await Promise.resolve(); // flush microtasks

      expect(reportError).toHaveBeenCalledWith(error, {
        scope: 'safeCancelDeviceConnection',
        deviceId: 'dev-1',
      });
    });
  });

  describe('safeRemoveSubscription', () => {
    it('is a no-op when subscription is null or undefined', () => {
      expect(() => safeRemoveSubscription(null)).not.toThrow();
      expect(() => safeRemoveSubscription(undefined)).not.toThrow();
      expect(reportError).not.toHaveBeenCalled();
    });

    it('calls remove on valid subscription', () => {
      const removeFn = jest.fn();
      const sub: Subscription = { remove: removeFn };

      safeRemoveSubscription(sub);
      expect(removeFn).toHaveBeenCalledTimes(1);
      expect(reportError).not.toHaveBeenCalled();
    });

    it('catches and reports error when remove throws', () => {
      const error = new Error('Subscription remove failure');
      const sub: Subscription = {
        remove: jest.fn(() => {
          throw error;
        }),
      };

      expect(() => safeRemoveSubscription(sub)).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(error, {
        scope: 'safeRemoveSubscription',
      });
    });
  });

  describe('safeDestroyManager', () => {
    it('destroys manager without error', () => {
      safeDestroyManager(mockManager);
      expect(mockManager.destroy).toHaveBeenCalledTimes(1);
      expect(reportError).not.toHaveBeenCalled();
    });

    it('catches and reports error when manager.destroy throws', () => {
      const error = new Error('Native manager destroy failure');
      (mockManager.destroy as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => safeDestroyManager(mockManager)).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(error, {
        scope: 'safeDestroyManager',
      });
    });
  });
});
