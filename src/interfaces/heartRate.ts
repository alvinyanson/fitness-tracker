/** Sensor contact status (GATT 0x2A37). */
export type HeartRateSensorContact =
  'notSupported' | 'contactDetected' | 'contactNotDetected';

/** Decoded Heart Rate Measurement. */
export interface HeartRateSample {
  bpm: number;
  sensorContact: HeartRateSensorContact;
  energyExpended?: number; // kJ
  rrIntervals?: number[]; // ms
  timestamp: number;
}
