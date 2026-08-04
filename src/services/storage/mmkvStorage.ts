import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

export function getItem<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    if (raw === undefined || raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (value === undefined) {
    throw new TypeError(
      'Cannot store undefined in MMKV storage; pass null instead.',
    );
  }
  const json = JSON.stringify(value);
  storage.set(key, json);
}

export function removeItem(key: string): void {
  storage.remove(key);
}
