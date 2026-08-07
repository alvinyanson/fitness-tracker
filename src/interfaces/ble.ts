/** Outcome of requesting the Android runtime BLE permissions. */
export type BlePermissionStatus = 'granted' | 'denied' | 'blocked';

/** Bluetooth adapter power state, collapsed from react-native-ble-plx's `State` enum. */
export type BluetoothAdapterStatus = 'poweredOn' | 'poweredOff' | 'unknown';

/**
 * Combined gate the pairing screen renders against. `'checking'` is the initial/retry
 * transient; every other value is terminal until the user acts (retry or Settings).
 */
export type BleGateStatus =
  | 'checking'
  | 'ready'
  | 'permissionDenied'
  | 'permissionBlocked'
  | 'bluetoothOff';
