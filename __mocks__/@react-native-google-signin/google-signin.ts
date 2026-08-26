declare module '@react-native-google-signin/google-signin' {
  export type MockSignInResponse =
    | { type: 'success'; data: { idToken: string | null } }
    | { type: 'cancelled'; data: null };
  export const __calls: string[];
  export const __configureCalls: { webClientId?: string }[];
  export function __setSignInResponse(response: MockSignInResponse): void;
  export function __setSignInError(error: unknown): void;
  export function __setPlayServicesError(error: unknown): void;
  export function __setSignOutError(error: unknown): void;
  export function __reset(): void;
}

export type MockSignInResponse =
  | { type: 'success'; data: { idToken: string | null } }
  | { type: 'cancelled'; data: null };

let signInResponse: MockSignInResponse = {
  type: 'success',
  data: { idToken: 'mock-id-token' },
};
let signInError: unknown = null;
let playServicesError: unknown = null;
let signOutError: unknown = null;

export const __calls: string[] = [];
export const __configureCalls: { webClientId?: string }[] = [];

export function __setSignInResponse(response: MockSignInResponse): void {
  signInResponse = response;
}

export function __setSignInError(error: unknown): void {
  signInError = error;
}

export function __setPlayServicesError(error: unknown): void {
  playServicesError = error;
}

export function __setSignOutError(error: unknown): void {
  signOutError = error;
}

export function __reset(): void {
  signInResponse = { type: 'success', data: { idToken: 'mock-id-token' } };
  signInError = null;
  playServicesError = null;
  signOutError = null;
  __calls.length = 0;
  __configureCalls.length = 0;
}

/** Mirrors the native module's runtime-resolved constants. */
export const statusCodes = Object.freeze({
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: '4',
  NULL_PRESENTER: 'NULL_PRESENTER',
});

export const GoogleSignin = {
  configure: (options: { webClientId?: string }) => {
    __configureCalls.push(options);
  },
  hasPlayServices: async () => {
    __calls.push('hasPlayServices');
    if (playServicesError) throw playServicesError;
    return true;
  },
  signIn: async (): Promise<MockSignInResponse> => {
    __calls.push('signIn');
    if (signInError) throw signInError;
    return signInResponse;
  },
  signOut: async () => {
    __calls.push('google.signOut');
    if (signOutError) throw signOutError;
    return null;
  },
};
