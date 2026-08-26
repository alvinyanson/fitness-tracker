import type { AuthErrorReason } from '@/interfaces/auth';

/**
 * `statusCodes` is built from native constants at runtime, so importing it here would
 * pull the native module into a pure unit. These are the values that module resolves to.
 */
const SIGN_IN_CANCELLED_CODES = ['12501', 'SIGN_IN_CANCELLED'];
const IN_PROGRESS_CODES = ['ASYNC_OP_IN_PROGRESS', 'IN_PROGRESS'];
const PLAY_SERVICES_CODES = ['PLAY_SERVICES_NOT_AVAILABLE'];
const NETWORK_CODES = [
  'auth/network-request-failed',
  '7', // GoogleSignInStatusCodes.NETWORK_ERROR
];

function readCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : null;
}

function isCancelledResponse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { type?: unknown }).type === 'cancelled';
}

/** Maps a thrown Google Sign-In / Firebase error to a reason. */
export function mapSignInError(error: unknown): AuthErrorReason {
  if (isCancelledResponse(error)) return 'cancelled';

  const code = readCode(error);
  if (code === null) return 'unknown';

  if (SIGN_IN_CANCELLED_CODES.includes(code)) return 'cancelled';
  if (IN_PROGRESS_CODES.includes(code)) return 'in-progress';
  if (PLAY_SERVICES_CODES.includes(code)) return 'play-services-unavailable';
  if (NETWORK_CODES.includes(code)) return 'network';

  return 'unknown';
}
