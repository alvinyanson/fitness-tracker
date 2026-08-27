import { useEffect } from 'react';
import type { UserPreferences } from '@/interfaces/preferences';
import {
  readPreferences,
  subscribeToPreferences,
  writePreferences,
} from '@/services/preferences/firestorePreferences';
import { mergePreferences } from '@/services/preferences/preferencesDocument';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { debounce } from '@/utils/debounce';

const WRITE_DEBOUNCE_MS = 1500;

/** The uid to sync, or null. Google only — a guest document could never reach a second device. */
function selectSyncableUid(state: AuthState): string | null {
  const { status, user } = state;
  if (status !== 'signed-in' || !user || user.isAnonymous === true) {
    return null;
  }
  return user.uid;
}

function readLocalPreferences(): UserPreferences {
  const { units, language, updatedAt } = useSettingsStore.getState();
  return { units, language, updatedAt };
}

/**
 * Mirrors units and language into `users/{uid}` for a Google-signed-in user. Mounted once,
 * at the root. Guests and signed-out users are untouched, and nothing here is user-visible.
 */
export function usePreferencesSync(): void {
  // A primitive, so any other auth write leaves this hook alone.
  const uid = useAuthStore(selectSyncableUid);

  useEffect(() => {
    if (!uid) return;

    let stopped = false;
    // The last `updatedAt` this device pushed or adopted, scoped to this one session.
    let syncedAt = 0;

    /** Uploads a value and records it as synced, so the echo it triggers is a no-op. */
    const pushToFirestore = (preferences: UserPreferences) => {
      syncedAt = preferences.updatedAt;
      writePreferences(uid, preferences).catch(() => {
        // Already reported by the adapter. No retry: the next preference change or
        // sign-in merge corrects a lost write.
      });
    };

    // Guards on `syncedAt`, so adopting a remote value never writes it straight back.
    const pushLocalChangeDebounced = debounce(() => {
      const local = readLocalPreferences();
      if (local.updatedAt > syncedAt) {
        pushToFirestore(local);
      }
    }, WRITE_DEBOUNCE_MS);

    // Guards on the store, so a snapshot older than what is on screen can never win.
    const adoptRemote = (remote: UserPreferences | null) => {
      if (!remote || remote.updatedAt <= readLocalPreferences().updatedAt) {
        return;
      }
      syncedAt = remote.updatedAt;
      useSettingsStore.getState().applyRemoteSettings(remote);
    };

    let unsubscribeRemote: (() => void) | null = null;

    const reconcile = async () => {
      let remote: UserPreferences | null = null;
      try {
        remote = await readPreferences(uid);
      } catch {
        // Already reported by the adapter; a null remote just resolves the merge to local.
      }
      if (stopped) return;

      const { winner, source } = mergePreferences(
        readLocalPreferences(),
        remote,
      );
      if (source === 'remote') {
        adoptRemote(winner);
      } else {
        pushToFirestore(winner);
      }

      unsubscribeRemote = subscribeToPreferences(uid, (next) => {
        if (!stopped) {
          adoptRemote(next);
        }
      });
    };

    void reconcile();

    const unsubscribeLocal = useSettingsStore.subscribe((state, previous) => {
      if (state.updatedAt > previous.updatedAt) {
        pushLocalChangeDebounced();
      }
    });

    return () => {
      stopped = true;
      pushLocalChangeDebounced.cancel();
      unsubscribeLocal();
      unsubscribeRemote?.();
    };
  }, [uid]);
}
