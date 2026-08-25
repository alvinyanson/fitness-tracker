declare module '@react-native-community/netinfo' {
  export function __setAddEventListenerError(error: Error | null): void;
  export function __emit(state: {
    isConnected: boolean;
    isInternetReachable: boolean | null;
  }): void;
  export function __listenerCount(): number;
  export function __reset(): void;
}

export interface MockNetInfoState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

type Listener = (state: MockNetInfoState) => void;

let mockedListenerError: Error | null = null;
let listeners: Listener[] = [];

/** Makes `addEventListener` throw, simulating an unavailable native module. */
export function __setAddEventListenerError(error: Error | null): void {
  mockedListenerError = error;
}

/** Broadcasts a state to every registered listener. */
export function __emit(state: MockNetInfoState): void {
  // Unsubscribing reassigns `listeners`, so this iterator keeps a stable snapshot.
  for (const listener of listeners) {
    listener(state);
  }
}

/** Number of currently registered listeners — asserts subscribe/unsubscribe. */
export function __listenerCount(): number {
  return listeners.length;
}

export function __reset(): void {
  mockedListenerError = null;
  listeners = [];
}

export function addEventListener(listener: Listener): () => void {
  if (mockedListenerError) {
    throw mockedListenerError;
  }
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
  };
}
