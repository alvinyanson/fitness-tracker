import { create } from 'zustand';
import type {
  AuthErrorReason,
  AuthProvider,
  AuthStatus,
  AuthUser,
} from '@/interfaces/auth';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  /** Which button is busy while `status === 'signing-in'`. */
  pendingProvider: AuthProvider | null;
  setUser: (user: AuthUser | null) => void;
  /**
   * `status` defaults to `'error'`. A user cancel passes `'signed-out'` instead: it carries
   * a reason but is a normal outcome, not a fault.
   */
  setError: (reason: AuthErrorReason, status?: AuthStatus) => void;
  setSigningIn: (provider: AuthProvider) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  errorReason: null,
  pendingProvider: null,
  // The listener's single write: status is derived, so the two cannot disagree.
  setUser: (user) => {
    set({
      user,
      status: user ? 'signed-in' : 'signed-out',
      errorReason: null,
      pendingProvider: null,
    });
  },
  setError: (reason, status = 'error') => {
    set({ status, errorReason: reason, pendingProvider: null });
  },
  setSigningIn: (provider) => {
    set({ status: 'signing-in', pendingProvider: provider, errorReason: null });
  },
}));
