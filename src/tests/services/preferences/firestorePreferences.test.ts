import {
  __calls,
  __emitSnapshot,
  __emitSnapshotError,
  __getDocumentData,
  __listenerCount,
  __reset,
  __setDocumentData,
  __setReadError,
  __setSubscribeError,
  __setWriteError,
} from '@react-native-firebase/firestore';
import {
  readPreferences,
  subscribeToPreferences,
  writePreferences,
} from '@/services/preferences/firestorePreferences';
import { reportError } from '@/services/crashService';

jest.mock('@react-native-firebase/firestore');
jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

const VALID = { units: 'imperial', language: 'ja', updatedAt: 42 } as const;

describe('firestorePreferences', () => {
  beforeEach(() => {
    __reset();
    jest.clearAllMocks();
  });

  describe('readPreferences', () => {
    it('returns a valid document', async () => {
      __setDocumentData({ ...VALID });
      await expect(readPreferences('uid-1')).resolves.toEqual(VALID);
      expect(__calls).toEqual(['getDoc:users/uid-1']);
    });

    it('returns null for a missing document', async () => {
      await expect(readPreferences('uid-1')).resolves.toBeNull();
    });

    it('returns null for an invalid document', async () => {
      __setDocumentData({ units: 'stones', language: 'en', updatedAt: 1 });
      await expect(readPreferences('uid-1')).resolves.toBeNull();
    });

    it('reports and rethrows a transport failure', async () => {
      __setReadError(new Error('unavailable'));
      await expect(readPreferences('uid-1')).rejects.toThrow('unavailable');
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        scope: 'firestorePreferences.readPreferences',
        uid: 'uid-1',
      });
    });
  });

  describe('writePreferences', () => {
    it('merges the document', async () => {
      await writePreferences('uid-1', { ...VALID });
      expect(__calls).toEqual(['setDoc:users/uid-1']);
      expect(__getDocumentData()).toEqual(VALID);
    });

    it('reports and rethrows a transport failure', async () => {
      __setWriteError(new Error('permission-denied'));
      await expect(writePreferences('uid-1', { ...VALID })).rejects.toThrow(
        'permission-denied',
      );
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        scope: 'firestorePreferences.writePreferences',
        uid: 'uid-1',
      });
    });
  });

  describe('subscribeToPreferences', () => {
    it('delivers valid snapshots and unsubscribes', () => {
      const onChange = jest.fn();
      const unsubscribe = subscribeToPreferences('uid-1', onChange);

      __emitSnapshot({ ...VALID });
      expect(onChange).toHaveBeenCalledWith(VALID);

      unsubscribe();
      expect(__listenerCount()).toBe(0);
    });

    it('delivers null for a missing or invalid document', () => {
      const onChange = jest.fn();
      subscribeToPreferences('uid-1', onChange);

      __emitSnapshot(null);
      expect(onChange).toHaveBeenLastCalledWith(null);

      __emitSnapshot({ units: 'stones', language: 'en', updatedAt: 1 });
      expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it('reports a snapshot error without invoking onChange', () => {
      const onChange = jest.fn();
      subscribeToPreferences('uid-1', onChange);

      expect(() =>
        __emitSnapshotError(new Error('listener failed')),
      ).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        scope: 'firestorePreferences.subscribeToPreferences',
        uid: 'uid-1',
      });
    });

    it('returns a no-op unsubscribe when subscribing itself throws', () => {
      __setSubscribeError(new Error('native module missing'));
      const onChange = jest.fn();

      const unsubscribe = subscribeToPreferences('uid-1', onChange);
      expect(() => unsubscribe()).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledTimes(1);
    });
  });
});
