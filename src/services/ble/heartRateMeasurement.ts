import type {
  HeartRateSample,
  HeartRateSensorContact,
} from '@/interfaces/heartRate';

/** Decodes a base64 string to Uint8Array, or null if invalid. */
function base64ToBytes(base64: string): Uint8Array | null {
  if (!base64 || typeof base64 !== 'string') return null;

  if (base64.length % 4 !== 0) return null;

  const lookup = new Int32Array(128).fill(-1);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const len = base64.length;
  let padding = 0;

  if (len > 0) {
    if (base64[len - 1] === '=') padding++;
    if (base64[len - 2] === '=') padding++;
  }

  if (padding > 2) return null;

  for (let i = 0; i < len - padding; i++) {
    const code = base64.charCodeAt(i);
    if (code >= 128 || lookup[code] === -1) return null;
  }
  for (let i = len - padding; i < len; i++) {
    if (base64[i] !== '=') return null;
  }

  const byteLen = (len * 3) / 4 - padding;
  if (byteLen <= 0) return null;

  const bytes = new Uint8Array(byteLen);
  let byteIdx = 0;

  for (let i = 0; i < len; i += 4) {
    const c0 = lookup[base64.charCodeAt(i)];
    const c1 = lookup[base64.charCodeAt(i + 1)];
    const isPad2 = base64[i + 2] === '=';
    const isPad3 = base64[i + 3] === '=';

    const c2 = isPad2 ? 0 : lookup[base64.charCodeAt(i + 2)];
    const c3 = isPad3 ? 0 : lookup[base64.charCodeAt(i + 3)];

    if (
      c0 === -1 ||
      c1 === -1 ||
      (!isPad2 && c2 === -1) ||
      (!isPad3 && c3 === -1)
    ) {
      return null;
    }

    if (isPad2 && !isPad3) return null;
    if ((isPad2 || isPad3) && i + 4 !== len) return null;

    bytes[byteIdx++] = (c0 << 2) | (c1 >> 4);
    if (!isPad2) {
      bytes[byteIdx++] = ((c1 & 15) << 4) | (c2 >> 2);
    }
    if (!isPad3) {
      bytes[byteIdx++] = ((c2 & 3) << 6) | c3;
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
  if (is16BitBpm) {
    bpm = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  } else {
    bpm = bytes[offset];
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
    energyExpended = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  }

  let rrIntervals: number[] | undefined;
  if (isRrPresent) {
    rrIntervals = [];
    while (offset < bytes.length) {
      const rawValue = bytes[offset] | (bytes[offset + 1] << 8);
      const ms = (rawValue * 1000) / 1024;
      rrIntervals.push(ms);
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
