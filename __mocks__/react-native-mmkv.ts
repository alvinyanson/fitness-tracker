const instances = new Map<string, Map<string, string>>();

export class MockMMKV {
  private instanceId: string;

  constructor(configuration?: { id?: string }) {
    this.instanceId = configuration?.id ?? 'default';
    if (!instances.has(this.instanceId)) {
      instances.set(this.instanceId, new Map());
    }
  }

  private get storage(): Map<string, string> {
    return instances.get(this.instanceId)!;
  }

  getString(key: string): string | undefined {
    return this.storage.get(key);
  }

  set(key: string, value: string | number | boolean | Uint8Array): void {
    if (typeof value === 'string') {
      this.storage.set(key, value);
    } else {
      this.storage.set(key, String(value));
    }
  }

  remove(key: string): boolean {
    return this.storage.delete(key);
  }

  delete(key: string): boolean {
    return this.remove(key);
  }

  clearAll(): void {
    this.storage.clear();
  }

  contains(key: string): boolean {
    return this.storage.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}

export const MMKV = MockMMKV;

export function createMMKV(configuration?: { id?: string }): MockMMKV {
  return new MockMMKV(configuration);
}
