import type {
  HeartRateSample,
  HeartRateSensorContact,
} from '@/interfaces/heartRate';

/** Decodes a base64 string to Uint8Array, or null if invalid. */
function base64ToBytes(base64: string): Uint8Array | null {
  if (!base64 || typeof base64 !== 'string') return null;

  if (base64.length % 4 !== 0) return null;

  const base64LookupTable = new Int32Array(128).fill(-1);
  const BASE64_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    base64LookupTable[BASE64_ALPHABET.charCodeAt(i)] = i;
  }

  const len = base64.length;
  let paddingCount = 0;

  if (len > 0) {
    if (base64[len - 1] === '=') paddingCount++;
    if (base64[len - 2] === '=') paddingCount++;
  }

  if (paddingCount > 2) return null;

  for (let i = 0; i < len - paddingCount; i++) {
    const code = base64.charCodeAt(i);
    if (code >= 128 || base64LookupTable[code] === -1) return null;
  }
  for (let i = len - paddingCount; i < len; i++) {
    if (base64[i] !== '=') return null;
  }

  const byteLen = (len * 3) / 4 - paddingCount;
  if (byteLen <= 0) return null;

  const bytes = new Uint8Array(byteLen);
  let outputByteIndex = 0;

  for (let i = 0; i < len; i += 4) {
    const b64Val0 = base64LookupTable[base64.charCodeAt(i)];
    const b64Val1 = base64LookupTable[base64.charCodeAt(i + 1)];
    const isChar2Padding = base64[i + 2] === '=';
    const isChar3Padding = base64[i + 3] === '=';

    const b64Val2 = isChar2Padding
      ? 0
      : base64LookupTable[base64.charCodeAt(i + 2)];
    const b64Val3 = isChar3Padding
      ? 0
      : base64LookupTable[base64.charCodeAt(i + 3)];

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

/** Decodes a Heart Rate Measurement (0x2A37) notification payload. */
export function parseHeartRateMeasurement(
  base64Value: string,
): HeartRateSample | null {
  const bytes = base64ToBytes(base64Value);
  if (!bytes || bytes.length < 1) {
    return null;
  }

  const flags = bytes[0];
  if (flags === undefined) {
    return null;
  }
  const is16BitBpm = (flags & 0x01) !== 0;
  const isContactSupported = (flags & 0x02) !== 0;
  const isContactDetected = (flags & 0x04) !== 0;
  const isEnergyPresent = (flags & 0x08) !== 0;
  const isRrPresent = (flags & 0x10) !== 0;

  const bpmWidth = is16BitBpm ? 2 : 1;
  const energyWidth = isEnergyPresent ? 2 : 0;
  const requiredMinLength = 1 + bpmWidth + energyWidth;

  if (bytes.length < requiredMinLength) {
    return null;
  }

  if (isRrPresent) {
    const rrBytes = bytes.length - requiredMinLength;
    if (rrBytes <= 0 || rrBytes % 2 !== 0) {
      return null;
    }
  }

  let offset = 1;

  let bpm: number;
  const bpmLowByte = bytes[offset];
  if (bpmLowByte === undefined) {
    return null;
  }
  if (is16BitBpm) {
    const bpmHighByte = bytes[offset + 1];
    if (bpmHighByte === undefined) {
      return null;
    }
    bpm = bpmLowByte | (bpmHighByte << 8);
    offset += 2;
  } else {
    bpm = bpmLowByte;
    offset += 1;
  }

  let sensorContact: HeartRateSensorContact;
  if (!isContactSupported) {
    sensorContact = 'notSupported';
  } else if (isContactDetected) {
    sensorContact = 'contactDetected';
  } else {
    sensorContact = 'contactNotDetected';
  }

  let energyExpended: number | undefined;
  if (isEnergyPresent) {
    const energyLowByte = bytes[offset];
    const energyHighByte = bytes[offset + 1];
    if (energyLowByte !== undefined && energyHighByte !== undefined) {
      energyExpended = energyLowByte | (energyHighByte << 8);
    }
    offset += 2;
  }

  let rrIntervals: number[] | undefined;
  if (isRrPresent) {
    rrIntervals = [];
    while (offset < bytes.length) {
      const rrLowByte = bytes[offset];
      const rrHighByte = bytes[offset + 1];
      if (rrLowByte !== undefined && rrHighByte !== undefined) {
        const rawRrUnits = rrLowByte | (rrHighByte << 8);
        const rrIntervalMs = (rawRrUnits * 1000) / 1024;
        rrIntervals.push(rrIntervalMs);
      }
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContact,
    ...(isEnergyPresent ? { energyExpended } : {}),
    ...(isRrPresent ? { rrIntervals } : {}),
    timestamp: Date.now(),
  };
}
