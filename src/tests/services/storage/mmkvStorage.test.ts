import { createMMKV } from 'react-native-mmkv';
import { getItem, setItem, removeItem } from '@/services/storage/mmkvStorage';

describe('mmkvStorage', () => {
  beforeEach(() => {
    createMMKV().clearAll();
  });

  it('returns null when key is missing', () => {
    expect(getItem('@fitness_tracker/test_key')).toBeNull();
  });

  it('stores and retrieves serialized values', () => {
    const testData = { id: '123', name: 'Test Device' };
    setItem('@fitness_tracker/test_key', testData);
    expect(getItem('@fitness_tracker/test_key')).toEqual(testData);
  });

  it('clears stored item when removeItem is called', () => {
    setItem('@fitness_tracker/test_key', 'some_value');
    removeItem('@fitness_tracker/test_key');
    expect(getItem('@fitness_tracker/test_key')).toBeNull();
  });

  it('returns null on corrupt or non-JSON stored string without throwing', () => {
    const mmkv = createMMKV();
    mmkv.set('@fitness_tracker/corrupt_key', '{bad_json');
    expect(() => getItem('@fitness_tracker/corrupt_key')).not.toThrow();
    expect(getItem('@fitness_tracker/corrupt_key')).toBeNull();
  });

  it('throws when setItem is called with undefined', () => {
    expect(() => {
      setItem('@fitness_tracker/test_key', undefined as unknown as null);
    }).toThrow(TypeError);
  });
});
