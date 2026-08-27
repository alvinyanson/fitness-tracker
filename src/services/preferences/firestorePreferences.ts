import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
} from '@react-native-firebase/firestore';
import type { UserPreferences } from '@/interfaces/preferences';
import { reportError } from '@/services/crashService';
import {
  preferencesPath,
  toUserPreferences,
} from '@/services/preferences/preferencesDocument';

function preferencesRef(uid: string) {
  return doc(getFirestore(), preferencesPath(uid));
}

function reportFailure(fn: string, uid: string, error: unknown): void {
  reportError(error, { scope: `firestorePreferences.${fn}`, uid });
}

/** null for a missing, empty, or invalid document. Rejects only on a transport failure. */
export async function readPreferences(
  uid: string,
): Promise<UserPreferences | null> {
  try {
    const snapshot = await getDoc(preferencesRef(uid));
    // A missing document has no data, which `toUserPreferences` already rejects.
    return toUserPreferences(snapshot.data());
  } catch (error) {
    reportFailure('readPreferences', uid, error);
    throw error;
  }
}

/**
 * Offline, the SDK persists the write to its own mutation queue and applies it to the local
 * cache at once, but this promise resolves only on server acknowledgement — so it stays
 * pending until reconnect. Callers must treat it as fire-and-forget, never as "the write
 * landed".
 */
export async function writePreferences(
  uid: string,
  preferences: UserPreferences,
): Promise<void> {
  try {
    await setDoc(preferencesRef(uid), preferences, { merge: true });
  } catch (error) {
    reportFailure('writePreferences', uid, error);
    throw error;
  }
}

/**
 * Returns the unsubscribe function. A snapshot error reports and stops there — a listener
 * failure must never surface as a settings change.
 */
export function subscribeToPreferences(
  uid: string,
  onChange: (preferences: UserPreferences | null) => void,
): () => void {
  try {
    return onSnapshot(
      preferencesRef(uid),
      (snapshot) => {
        onChange(toUserPreferences(snapshot.data()));
      },
      (error) => {
        reportFailure('subscribeToPreferences', uid, error);
      },
    );
  } catch (error) {
    // Subscribing itself only throws if the native module is missing.
    reportFailure('subscribeToPreferences', uid, error);
    return () => {};
  }
}
