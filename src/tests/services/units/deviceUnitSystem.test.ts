import * as Localization from 'expo-localization';
import { getDeviceUnitSystem } from '@/services/units/deviceUnitSystem';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

const getLocales = Localization.getLocales as jest.Mock;

describe('getDeviceUnitSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps us to imperial', () => {
    getLocales.mockReturnValue([{ measurementSystem: 'us' }]);
    expect(getDeviceUnitSystem()).toBe('imperial');
  });

  it('maps uk to imperial', () => {
    getLocales.mockReturnValue([{ measurementSystem: 'uk' }]);
    expect(getDeviceUnitSystem()).toBe('imperial');
  });

  it('maps metric to metric', () => {
    getLocales.mockReturnValue([{ measurementSystem: 'metric' }]);
    expect(getDeviceUnitSystem()).toBe('metric');
  });

  it('falls back to metric when measurementSystem is null', () => {
    getLocales.mockReturnValue([{ measurementSystem: null }]);
    expect(getDeviceUnitSystem()).toBe('metric');
  });

  it('falls back to metric when the field is absent', () => {
    getLocales.mockReturnValue([{ languageCode: 'en' }]);
    expect(getDeviceUnitSystem()).toBe('metric');
  });

  it('falls back to metric when getLocales returns an empty list', () => {
    getLocales.mockReturnValue([]);
    expect(getDeviceUnitSystem()).toBe('metric');
  });
});
