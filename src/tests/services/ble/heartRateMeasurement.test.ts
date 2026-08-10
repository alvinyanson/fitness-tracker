import { parseHeartRateMeasurement } from '@/services/ble/heartRateMeasurement';

declare const Buffer: any;

describe('parseHeartRateMeasurement', () => {
  function toBase64(bytes: number[]): string {
    return Buffer.from(bytes).toString('base64');
  }

  it('decodes uint8 BPM when flag bit 0 is 0', () => {
    // Flag: 0x00 (uint8 BPM, contact not supported, no energy, no RR)
    // BPM: 80 (0x50)
    const base64 = toBase64([0x00, 80]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample).toEqual({
      bpm: 80,
      sensorContact: 'notSupported',
      timestamp: expect.any(Number),
    });
    expect(sample?.energyExpended).toBeUndefined();
    expect(sample?.rrIntervals).toBeUndefined();
  });

  it('decodes uint16 BPM when flag bit 0 is 1', () => {
    // Flag: 0x01 (uint16 BPM)
    // BPM: 300 (0x012C -> 0x2C, 0x01)
    const base64 = toBase64([0x01, 0x2c, 0x01]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample).toEqual({
      bpm: 300,
      sensorContact: 'notSupported',
      timestamp: expect.any(Number),
    });
  });

  it('decodes sensorContact as contactDetected when bits 1 and 2 are 1', () => {
    // Flag: 0x06 (bit 1=1, bit 2=1 -> contact detected)
    // BPM: 75
    const base64 = toBase64([0x06, 75]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.sensorContact).toBe('contactDetected');
  });

  it('decodes sensorContact as contactNotDetected when bit 1 is 1 and bit 2 is 0', () => {
    // Flag: 0x02 (bit 1=1, bit 2=0 -> contact not detected)
    // BPM: 75
    const base64 = toBase64([0x02, 75]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.sensorContact).toBe('contactNotDetected');
  });

  it('decodes sensorContact as notSupported when bit 1 is 0 even if bit 2 is 1', () => {
    // Flag: 0x04 (bit 1=0, bit 2=1)
    // BPM: 75
    const base64 = toBase64([0x04, 75]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.sensorContact).toBe('notSupported');
  });

  it('decodes energyExpended when flag bit 3 is 1', () => {
    // Flag: 0x08 (bit 3=1)
    // BPM: 80
    // Energy Expended: 500 kJ (0x01F4 -> 0xF4, 0x01)
    const base64 = toBase64([0x08, 80, 0xf4, 0x01]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.energyExpended).toBe(500);
  });

  it('decodes single RR interval converted from 1/1024s to ms when flag bit 4 is 1', () => {
    // Flag: 0x10 (bit 4=1)
    // BPM: 60
    // RR Interval: 1024 (1024 * 1000 / 1024 = 1000ms, 0x0400 -> 0x00, 0x04)
    const base64 = toBase64([0x10, 60, 0x00, 0x04]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.rrIntervals).toEqual([1000]);
  });

  it('decodes multiple RR intervals when flag bit 4 is 1', () => {
    // Flag: 0x10 (bit 4=1)
    // BPM: 60
    // RR1: 1024 (1000ms), RR2: 512 (500ms, 0x0200 -> 0x00, 0x02)
    const base64 = toBase64([0x10, 60, 0x00, 0x04, 0x00, 0x02]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).not.toBeNull();
    expect(sample?.rrIntervals).toEqual([1000, 500]);
  });

  it('decodes payload with all optional fields combined', () => {
    // Flag: 0x1F (uint16 BPM, contact detected, energy present, RR present)
    // BPM: 300 (0x2C, 0x01)
    // Energy: 1000 kJ (0x03E8 -> 0xE8, 0x03)
    // RR: 1024 (1000ms -> 0x00, 0x04), 800 (800*1000/1024 = 781.25ms -> 0x0320 -> 0x20, 0x03)
    const base64 = toBase64([
      0x1f, 0x2c, 0x01, 0xe8, 0x03, 0x00, 0x04, 0x20, 0x03,
    ]);
    const sample = parseHeartRateMeasurement(base64);

    expect(sample).toEqual({
      bpm: 300,
      sensorContact: 'contactDetected',
      energyExpended: 1000,
      rrIntervals: [1000, 781.25],
      timestamp: expect.any(Number),
    });
  });

  it('returns null for truncated uint16 BPM payload', () => {
    // Flag 0x01 expects 1 + 2 = 3 bytes minimum, but only 2 provided
    const base64 = toBase64([0x01, 0x2c]);
    expect(parseHeartRateMeasurement(base64)).toBeNull();
  });

  it('returns null for truncated energy expended payload', () => {
    // Flag 0x08 expects 1 + 1 + 2 = 4 bytes minimum, but only 2 provided
    const base64 = toBase64([0x08, 80]);
    expect(parseHeartRateMeasurement(base64)).toBeNull();
  });

  it('returns null when RR interval flag is set but no RR bytes follow', () => {
    // Flag 0x10 expects RR bytes, but only BPM byte provided
    const base64 = toBase64([0x10, 80]);
    expect(parseHeartRateMeasurement(base64)).toBeNull();
  });

  it('returns null when RR interval trailing bytes length is odd', () => {
    // Flag 0x10 with 1 trailing byte (needs positive even multiple of 2)
    const base64 = toBase64([0x10, 80, 0x00]);
    expect(parseHeartRateMeasurement(base64)).toBeNull();
  });

  it('returns null for empty payload or empty base64 string', () => {
    expect(parseHeartRateMeasurement('')).toBeNull();
  });

  it('returns null for invalid base64 characters', () => {
    expect(parseHeartRateMeasurement('!!!InvalidBase64!!!')).toBeNull();
  });

  it('returns null for malformed base64 length or padding', () => {
    expect(parseHeartRateMeasurement('AFA')).toBeNull(); // length 3, not multiple of 4
    expect(parseHeartRateMeasurement('AF===')).toBeNull(); // too many pad chars
  });
});
