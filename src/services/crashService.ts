import { getCrashlytics } from '@react-native-firebase/crashlytics';
import type { AuthUser } from '@/interfaces/auth';

type Crashlytics = ReturnType<typeof getCrashlytics>;

/**
 * Runs `fn` against the Crashlytics instance, swallowing failures so a missing
 * or uninitialized native module (tests, dev without Firebase) never throws.
 */
function withCrashlytics(
  fn: (instance: Crashlytics) => void,
  onFailLabel: string,
): void {
  try {
    fn(getCrashlytics());
  } catch (e) {
    if (__DEV__) {
      console.warn(`[${onFailLabel}] Crashlytics call failed:`, e);
    }
  }
}

/** Initializes Crashlytics collection state based on environment. */
export function initCrashlytics(): void {
  withCrashlytics(
    (instance) => instance.setCrashlyticsCollectionEnabled(!__DEV__),
    'initCrashlytics',
  );
}

// Auto-initialize on module load
initCrashlytics();

/** Records a handled error as a non-fatal. Use for genuine bugs, not expected errors. */
export function reportError(
  error: unknown,
  context?: Record<string, string>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) {
    console.error('[reportError]', err, context ?? '');
  }
  withCrashlytics((instance) => {
    if (context) {
      instance.log(JSON.stringify(context));
    }
    instance.recordError(err);
  }, 'reportError');
}

/** Leaves a breadcrumb, attached to the next reported error/crash. */
export function logBreadcrumb(message: string): void {
  if (__DEV__) {
    console.log('[Breadcrumb]', message);
  }
  withCrashlytics((instance) => instance.log(message), 'logBreadcrumb');
}

/** Attributes subsequent reports to the signed-in user. */
export function setCrashUser(user: AuthUser | null): void {
  if (!user) return;
  withCrashlytics((instance) => {
    instance.setUserId(user.uid);
    if (user.isAnonymous !== undefined) {
      instance.setAttributes({ isAnonymous: String(user.isAnonymous) });
    }
  }, 'setCrashUser');
}
