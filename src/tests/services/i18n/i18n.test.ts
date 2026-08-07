import * as Localization from 'expo-localization';
import { i18n, setLocale, getDeviceLocale } from '@/services/i18n/i18n';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

describe('i18n service', () => {
  beforeEach(() => {
    setLocale('en');
    jest.clearAllMocks();
  });

  describe('setLocale & translation', () => {
    it('translates keys for english', () => {
      setLocale('en');
      expect(i18n.t('pairing.title')).toBe('Pairing');
    });

    it('translates keys for japanese', () => {
      setLocale('ja');
      expect(i18n.t('pairing.title')).toBe('ペアリング');
    });

    it('falls back to placeholder when key is missing in all locales', () => {
      setLocale('ja');
      expect(i18n.t('nonexistent.key')).toContain('missing');
    });
  });

  describe('getDeviceLocale', () => {
    it('returns supported locale when device matches supported locale', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'ja' },
      ]);
      expect(getDeviceLocale()).toBe('ja');
    });

    it('returns default locale when device locale is unsupported', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'fr' },
      ]);
      expect(getDeviceLocale()).toBe('en');
    });

    it('returns default locale when getLocales returns empty array', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([]);
      expect(getDeviceLocale()).toBe('en');
    });
  });
});
