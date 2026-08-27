import type { UserPreferences } from '@/interfaces/preferences';
import {
  mergePreferences,
  preferencesPath,
  toUserPreferences,
} from '@/services/preferences/preferencesDocument';

const LOCAL: UserPreferences = {
  units: 'metric',
  language: 'en',
  updatedAt: 1_000,
};

describe('preferencesPath', () => {
  it('builds the per-user document path', () => {
    expect(preferencesPath('uid-1')).toBe('users/uid-1');
  });

  it('throws on an empty uid', () => {
    expect(() => preferencesPath('')).toThrow(TypeError);
  });
});

describe('toUserPreferences', () => {
  it('accepts a valid document', () => {
    expect(
      toUserPreferences({ units: 'imperial', language: 'ja', updatedAt: 5 }),
    ).toEqual({ units: 'imperial', language: 'ja', updatedAt: 5 });
  });

  it('ignores unknown extra fields', () => {
    expect(
      toUserPreferences({
        units: 'metric',
        language: 'en',
        updatedAt: 5,
        weight: 70,
      }),
    ).toEqual({ units: 'metric', language: 'en', updatedAt: 5 });
  });

  it.each([
    [
      'an unknown units value',
      { units: 'stones', language: 'en', updatedAt: 5 },
    ],
    ['an unknown language', { units: 'metric', language: 'fr', updatedAt: 5 }],
    [
      'a non-numeric updatedAt',
      { units: 'metric', language: 'en', updatedAt: '5' },
    ],
    ['a NaN updatedAt', { units: 'metric', language: 'en', updatedAt: NaN }],
    ['a missing updatedAt', { units: 'metric', language: 'en' }],
    ['an empty object', {}],
  ])('rejects %s', (_label, data) => {
    expect(toUserPreferences(data)).toBeNull();
  });

  it.each([[null], [undefined], ['metric'], [42]])(
    'rejects the non-object %p',
    (data) => {
      expect(toUserPreferences(data)).toBeNull();
    },
  );
});

describe('mergePreferences', () => {
  it('lets a newer remote win', () => {
    const remote: UserPreferences = {
      units: 'imperial',
      language: 'ja',
      updatedAt: 2_000,
    };
    expect(mergePreferences(LOCAL, remote)).toEqual({
      winner: remote,
      source: 'remote',
    });
  });

  it('lets a newer local win', () => {
    const remote: UserPreferences = {
      units: 'imperial',
      language: 'ja',
      updatedAt: 500,
    };
    expect(mergePreferences(LOCAL, remote)).toEqual({
      winner: LOCAL,
      source: 'local',
    });
  });

  it('resolves an equal updatedAt to local', () => {
    const remote: UserPreferences = {
      units: 'imperial',
      language: 'ja',
      updatedAt: LOCAL.updatedAt,
    };
    expect(mergePreferences(LOCAL, remote).source).toBe('local');
  });

  it('resolves a null remote to local', () => {
    expect(mergePreferences(LOCAL, null)).toEqual({
      winner: LOCAL,
      source: 'local',
    });
  });
});
