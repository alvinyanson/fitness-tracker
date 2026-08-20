import { decodeBase64 } from '@/utils/base64';

declare const Buffer: any;

describe('decodeBase64', () => {
  function toBase64(bytes: number[]): string {
    return Buffer.from(bytes).toString('base64');
  }

  it('decodes valid base64 strings with no padding', () => {
    const input = [1, 2, 3];
    const b64 = toBase64(input);
    const result = decodeBase64(b64);
    expect(result).toEqual(new Uint8Array(input));
  });

  it('decodes valid base64 strings with 1 padding character', () => {
    const input = [10, 20];
    const b64 = toBase64(input);
    const result = decodeBase64(b64);
    expect(result).toEqual(new Uint8Array(input));
  });

  it('decodes valid base64 strings with 2 padding characters', () => {
    const input = [255];
    const b64 = toBase64(input);
    const result = decodeBase64(b64);
    expect(result).toEqual(new Uint8Array(input));
  });

  it('decodes multi-block binary payload correctly', () => {
    const input = [0x1f, 0x2c, 0x01, 0xe8, 0x03, 0x00, 0x04, 0x20, 0x03];
    const b64 = toBase64(input);
    const result = decodeBase64(b64);
    expect(result).toEqual(new Uint8Array(input));
  });

  it('returns null for empty string or non-string inputs', () => {
    expect(decodeBase64('')).toBeNull();
    expect(decodeBase64(null as unknown as string)).toBeNull();
    expect(decodeBase64(undefined as unknown as string)).toBeNull();
    expect(decodeBase64(123 as unknown as string)).toBeNull();
  });

  it('returns null when length is not a multiple of 4', () => {
    expect(decodeBase64('A')).toBeNull();
    expect(decodeBase64('AA')).toBeNull();
    expect(decodeBase64('AAA')).toBeNull();
    expect(decodeBase64('AAAAA')).toBeNull();
  });

  it('returns null for strings containing invalid characters', () => {
    expect(decodeBase64('AAAA!AAA')).toBeNull();
    expect(decodeBase64('AA@#')).toBeNull();
    expect(decodeBase64('AA==\u0000')).toBeNull();
  });

  it('returns null for malformed padding', () => {
    expect(decodeBase64('==AA')).toBeNull();
    expect(decodeBase64('A=AA')).toBeNull();
    expect(decodeBase64('A===')).toBeNull();
    expect(decodeBase64('====')).toBeNull();
  });

  it('returns null when padding occurs in the middle of a string', () => {
    expect(decodeBase64('AA==AAAA')).toBeNull();
  });
});
