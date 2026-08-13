import { getCrashlytics } from '@react-native-firebase/crashlytics';
import {
  initCrashlytics,
  logBreadcrumb,
  reportError,
  setCrashUser,
} from '@/services/crashService';

describe('crashService', () => {
  let mockCrashlytics: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCrashlytics = getCrashlytics();
  });

  describe('initCrashlytics', () => {
    it('disables collection when __DEV__ is true', () => {
      initCrashlytics();
      expect(
        mockCrashlytics.setCrashlyticsCollectionEnabled,
      ).toHaveBeenCalledWith(false);
    });
  });

  describe('reportError', () => {
    it('logs error to console.error and records error on Crashlytics instance', () => {
      const spyError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const testError = new Error('Test error');

      reportError(testError, { scope: 'test' });

      expect(spyError).toHaveBeenCalledWith('[reportError]', testError, {
        scope: 'test',
      });
      expect(mockCrashlytics.log).toHaveBeenCalledWith(
        JSON.stringify({ scope: 'test' }),
      );
      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(testError);
      spyError.mockRestore();
    });
  });

  describe('logBreadcrumb', () => {
    it('logs breadcrumb to console.log and invokes crashlytics.log', () => {
      const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      logBreadcrumb('Test breadcrumb');

      expect(spyLog).toHaveBeenCalledWith('[Breadcrumb]', 'Test breadcrumb');
      expect(mockCrashlytics.log).toHaveBeenCalledWith('Test breadcrumb');
      spyLog.mockRestore();
    });
  });

  describe('setCrashUser', () => {
    it('sets user ID and attributes on Crashlytics instance', () => {
      setCrashUser({ uid: 'user123', isAnonymous: false });
      expect(mockCrashlytics.setUserId).toHaveBeenCalledWith('user123');
      expect(mockCrashlytics.setAttributes).toHaveBeenCalledWith({
        isAnonymous: 'false',
      });
    });
  });
});
