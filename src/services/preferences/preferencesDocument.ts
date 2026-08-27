import {
  PREFERENCES_COLLECTION,
  type PreferenceMergeResult,
  type UserPreferences,
} from '@/interfaces/preferences';
import { SUPPORTED_LOCALES, type LocaleCode } from '@/interfaces/i18n';
import { SUPPORTED_UNIT_SYSTEMS, type UnitSystem } from '@/interfaces/units';

/** `users/{uid}`. Throws on an empty uid rather than building a collection path. */
export function preferencesPath(uid: string): string {
  if (!uid) {
    throw new TypeError('preferencesPath requires a non-empty uid');
  }
  return `${PREFERENCES_COLLECTION}/${uid}`;
}

function isUnitSystem(value: unknown): value is UnitSystem {
  return SUPPORTED_UNIT_SYSTEMS.includes(value as UnitSystem);
}

function isLocaleCode(value: unknown): value is LocaleCode {
  return SUPPORTED_LOCALES.includes(value as LocaleCode);
}

/**
 * Validates an unknown remote payload. Rejects rather than coerces: an unrecognised
 * `units` or `language` must never reach the store.
 */
export function toUserPreferences(data: unknown): UserPreferences | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const { units, language, updatedAt } = data as Record<string, unknown>;

  if (!isUnitSystem(units) || !isLocaleCode(language)) {
    return null;
  }
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    return null;
  }
  return { units, language, updatedAt };
}

/** Higher `updatedAt` wins; a tie and a null remote both resolve to local. */
export function mergePreferences(
  local: UserPreferences,
  remote: UserPreferences | null,
): PreferenceMergeResult {
  if (remote && remote.updatedAt > local.updatedAt) {
    return { winner: remote, source: 'remote' };
  }
  return { winner: local, source: 'local' };
}
