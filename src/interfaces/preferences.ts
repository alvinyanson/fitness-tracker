import type { LocaleCode } from '@/interfaces/i18n';
import type { UnitSystem } from '@/interfaces/units';

/** The whole synced document. One per user, no subcollections. */
export interface UserPreferences {
  units: UnitSystem;
  language: LocaleCode;
  /** Client epoch ms — the last-write-wins key. */
  updatedAt: number;
}

/** Which side of a merge won, for logging and for the write-back decision. */
export type PreferenceMergeSource = 'local' | 'remote';

export interface PreferenceMergeResult {
  winner: UserPreferences;
  source: PreferenceMergeSource;
}

export const PREFERENCES_COLLECTION = 'users';
