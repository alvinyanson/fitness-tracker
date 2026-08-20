const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP = new Int32Array(128).fill(-1);
for (let i = 0; i < BASE64_ALPHABET.length; i++) {
  BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(i)] = i;
}

/** Decodes a base64 string to Uint8Array, or null if invalid. */
export function decodeBase64(base64: string): Uint8Array | null {
  if (!base64 || typeof base64 !== 'string') return null;

  if (base64.length % 4 !== 0) return null;

  const len = base64.length;
  let paddingCount = 0;

  if (len > 0) {
    if (base64[len - 1] === '=') paddingCount++;
    if (base64[len - 2] === '=') paddingCount++;
  }

  if (paddingCount > 2) return null;

  for (let i = 0; i < len - paddingCount; i++) {
    const code = base64.charCodeAt(i);
    if (code >= 128 || BASE64_LOOKUP[code] === -1) return null;
  }
  for (let i = len - paddingCount; i < len; i++) {
    if (base64[i] !== '=') return null;
  }

  const byteLen = (len * 3) / 4 - paddingCount;
  if (byteLen <= 0) return null;

  const bytes = new Uint8Array(byteLen);
  let outputByteIndex = 0;

  for (let i = 0; i < len; i += 4) {
    const b64Val0 = BASE64_LOOKUP[base64.charCodeAt(i)];
    const b64Val1 = BASE64_LOOKUP[base64.charCodeAt(i + 1)];
    const isChar2Padding = base64[i + 2] === '=';
    const isChar3Padding = base64[i + 3] === '=';

    const b64Val2 = isChar2Padding
      ? 0
      : BASE64_LOOKUP[base64.charCodeAt(i + 2)];
    const b64Val3 = isChar3Padding
      ? 0
      : BASE64_LOOKUP[base64.charCodeAt(i + 3)];

    if (
      b64Val0 === undefined ||
      b64Val1 === undefined ||
      b64Val2 === undefined ||
      b64Val3 === undefined ||
      b64Val0 === -1 ||
      b64Val1 === -1 ||
      (!isChar2Padding && b64Val2 === -1) ||
      (!isChar3Padding && b64Val3 === -1)
    ) {
      return null;
    }

    if (isChar2Padding && !isChar3Padding) return null;
    if ((isChar2Padding || isChar3Padding) && i + 4 !== len) return null;

    bytes[outputByteIndex++] = (b64Val0 << 2) | (b64Val1 >> 4);
    if (!isChar2Padding) {
      bytes[outputByteIndex++] = ((b64Val1 & 15) << 4) | (b64Val2 >> 2);
    }
    if (!isChar3Padding) {
      bytes[outputByteIndex++] = ((b64Val2 & 3) << 6) | b64Val3;
    }
  }

  return bytes;
}
