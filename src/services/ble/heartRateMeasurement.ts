import type {
  HeartRateSample,
  HeartRateSensorContact,
} from '@/interfaces/heartRate';
import { decodeBase64 } from '@/utils/base64';

/** Decodes a Heart Rate Measurement (0x2A37) notification payload. */
export function parseHeartRateMeasurement(
  base64Value: string,
  now = Date.now(),
): HeartRateSample | null {
  const bytes = decodeBase64(base64Value);
  if (!bytes || bytes.length < 1) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint8(0);
  const is16BitBpm = (flags & 0x01) !== 0;
  const isContactSupported = (flags & 0x02) !== 0;
  const isContactDetected = (flags & 0x04) !== 0;
  const isEnergyPresent = (flags & 0x08) !== 0;
  const isRrPresent = (flags & 0x10) !== 0;

  const bpmWidth = is16BitBpm ? 2 : 1;
  const energyWidth = isEnergyPresent ? 2 : 0;
  const requiredMinLength = 1 + bpmWidth + energyWidth;

  if (view.byteLength < requiredMinLength) {
    return null;
  }

  if (isRrPresent) {
    const rrBytes = view.byteLength - requiredMinLength;
    if (rrBytes <= 0 || rrBytes % 2 !== 0) {
      return null;
    }
  }

  let offset = 1;

  let bpm: number;
  if (is16BitBpm) {
    bpm = view.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = view.getUint8(offset);
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
    energyExpended = view.getUint16(offset, true);
    offset += 2;
  }

  let rrIntervals: number[] | undefined;
  if (isRrPresent) {
    rrIntervals = [];
    while (offset < view.byteLength) {
      const rawRrUnits = view.getUint16(offset, true);
      const rrIntervalMs = (rawRrUnits * 1000) / 1024;
      rrIntervals.push(rrIntervalMs);
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContact,
    ...(isEnergyPresent ? { energyExpended } : {}),
    ...(isRrPresent ? { rrIntervals } : {}),
    timestamp: now,
  };
}
