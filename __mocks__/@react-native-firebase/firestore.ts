declare module '@react-native-firebase/firestore' {
  export const __calls: string[];
  export function __setDocumentData(data: Record<string, unknown> | null): void;
  export function __getDocumentData(): Record<string, unknown> | null;
  export function __setReadError(error: unknown): void;
  export function __setWriteError(error: unknown): void;
  export function __setSubscribeError(error: Error | null): void;
  export function __emitSnapshot(data: Record<string, unknown> | null): void;
  export function __emitSnapshotError(error: unknown): void;
  export function __listenerCount(): number;
  export function __reset(): void;
}

type Snapshot = {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
};

type NextListener = (snapshot: Snapshot) => void;
type ErrorListener = (error: unknown) => void;

let documentData: Record<string, unknown> | null = null;
let readError: unknown = null;
let writeError: unknown = null;
let subscribeError: Error | null = null;
let listeners: { next: NextListener; error?: ErrorListener }[] = [];

/** Every native call this module received, in order. */
export const __calls: string[] = [];

function toSnapshot(data: Record<string, unknown> | null): Snapshot {
  return {
    exists: () => data !== null,
    data: () => data ?? undefined,
  };
}

export function __setDocumentData(data: Record<string, unknown> | null): void {
  documentData = data;
}

export function __getDocumentData(): Record<string, unknown> | null {
  return documentData;
}

export function __setReadError(error: unknown): void {
  readError = error;
}

export function __setWriteError(error: unknown): void {
  writeError = error;
}

/** Makes `onSnapshot` itself throw, simulating an unavailable native module. */
export function __setSubscribeError(error: Error | null): void {
  subscribeError = error;
}

export function __emitSnapshot(data: Record<string, unknown> | null): void {
  for (const listener of listeners) {
    listener.next(toSnapshot(data));
  }
}

export function __emitSnapshotError(error: unknown): void {
  for (const listener of listeners) {
    listener.error?.(error);
  }
}

export function __listenerCount(): number {
  return listeners.length;
}

export function __reset(): void {
  documentData = null;
  readError = null;
  writeError = null;
  subscribeError = null;
  listeners = [];
  __calls.length = 0;
}

export function getFirestore(): { __mock: true } {
  return { __mock: true };
}

export function doc(_firestore: unknown, path: string): { path: string } {
  return { path };
}

export async function getDoc(reference: { path: string }): Promise<Snapshot> {
  __calls.push(`getDoc:${reference.path}`);
  if (readError) throw readError;
  return toSnapshot(documentData);
}

export async function setDoc(
  reference: { path: string },
  data: Record<string, unknown>,
): Promise<void> {
  __calls.push(`setDoc:${reference.path}`);
  if (writeError) throw writeError;
  documentData = { ...documentData, ...data };
}

export function onSnapshot(
  reference: { path: string },
  next: NextListener,
  error?: ErrorListener,
): () => void {
  __calls.push(`onSnapshot:${reference.path}`);
  if (subscribeError) {
    throw subscribeError;
  }
  const listener = { next, error };
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
  };
}
