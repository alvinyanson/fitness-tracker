import { mapSignInError } from '@/services/auth/authErrors';

describe('mapSignInError', () => {
  it('maps the native cancel code to cancelled', () => {
    expect(mapSignInError({ code: '12501' })).toBe('cancelled');
  });

  it('maps the discriminated cancelled result shape to cancelled', () => {
    expect(mapSignInError({ type: 'cancelled', data: null })).toBe('cancelled');
  });

  it('maps the in-progress code', () => {
    expect(mapSignInError({ code: 'ASYNC_OP_IN_PROGRESS' })).toBe(
      'in-progress',
    );
  });

  it('maps the play services code', () => {
    expect(mapSignInError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' })).toBe(
      'play-services-unavailable',
    );
  });

  it('maps the firebase network failure code', () => {
    expect(mapSignInError({ code: 'auth/network-request-failed' })).toBe(
      'network',
    );
  });

  it('reads a numeric code as its string form', () => {
    expect(mapSignInError({ code: 12501 })).toBe('cancelled');
  });

  it('returns unknown for undefined', () => {
    expect(mapSignInError(undefined)).toBe('unknown');
  });

  it('returns unknown for null', () => {
    expect(mapSignInError(null)).toBe('unknown');
  });

  it('returns unknown for a bare string', () => {
    expect(mapSignInError('SIGN_IN_CANCELLED oops')).toBe('unknown');
  });

  it('returns unknown for an Error with no code', () => {
    expect(mapSignInError(new Error('boom'))).toBe('unknown');
  });

  it('returns unknown for an unrecognised code', () => {
    expect(mapSignInError({ code: 'auth/too-many-requests' })).toBe('unknown');
  });
});
