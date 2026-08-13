import { getCrashlytics } from '@react-native-firebase/crashlytics';
import type { AuthUser } from '@/interfaces/auth';

/** Initializes Crashlytics collection state based on environment. */
export function initCrashlytics(): void {
  try {
    const instance = getCrashlytics();
    instance.setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    // Safe fallback in uninitialized/test environments
  }
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
  try {
    const instance = getCrashlytics();
    if (context) {
      instance.log(JSON.stringify(context));
    }
    instance.recordError(err);
  } catch (e) {
    if (__DEV__) {
      console.warn('[reportError] Crashlytics recordError failed:', e);
    }
  }
}

/** Leaves a breadcrumb, attached to the next reported error/crash. */
export function logBreadcrumb(message: string): void {
  if (__DEV__) {
    console.log('[Breadcrumb]', message);
  }
  try {
    const instance = getCrashlytics();
    instance.log(message);
  } catch {
    // Safe fallback when Crashlytics is uninitialized in dev/test
  }
}

/** Attributes subsequent reports to the signed-in user. */
export function setCrashUser(user: AuthUser | null): void {
  if (!user) return;
  try {
    const instance = getCrashlytics();
    instance.setUserId(user.uid);
    if (user.isAnonymous !== undefined) {
      instance.setAttributes({ isAnonymous: String(user.isAnonymous) });
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[setCrashUser] Crashlytics setUserId failed:', e);
    }
  }
}
