import { toAuthUser } from '@/services/auth/firebaseAuth';
import type { MockFirebaseUser } from '@react-native-firebase/auth';

jest.mock('@react-native-firebase/auth');

const FULL_USER: MockFirebaseUser = {
  uid: 'uid-1',
  isAnonymous: false,
  email: 'alex@example.com',
  displayName: 'Alex Rivera',
  photoURL: 'https://example.com/a.png',
};

describe('toAuthUser', () => {
  it('returns null for a null user', () => {
    expect(toAuthUser(null)).toBeNull();
  });

  it('maps every field of a full user', () => {
    expect(toAuthUser(FULL_USER as never)).toEqual({
      uid: 'uid-1',
      isAnonymous: false,
      email: 'alex@example.com',
      displayName: 'Alex Rivera',
      photoURL: 'https://example.com/a.png',
    });
  });

  it('keeps withheld profile fields as null without throwing', () => {
    const withheld: MockFirebaseUser = {
      uid: 'uid-2',
      isAnonymous: false,
      email: null,
      displayName: null,
      photoURL: null,
    };

    expect(toAuthUser(withheld as never)).toEqual({
      uid: 'uid-2',
      isAnonymous: false,
      email: null,
      displayName: null,
      photoURL: null,
    });
  });
});
