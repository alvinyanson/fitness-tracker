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

/** A device seen during a scan, not yet connected. */
export interface DiscoveredDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

/** A device the app has successfully connected to at least once this session. */
export interface PairedDevice {
  id: string;
  name: string | null;
}

/**
 * The simple state label every caller switches on. `CLAUDE.md`'s domain
 * convention: every new async flow follows this shape, not booleans.
 */
export type BleConnectionState =
  'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Why a `disconnected` snapshot happened. Both are routine, per CLAUDE.md — neither is an error. */
export type BleDisconnectReason = 'userInitiated' | 'unexpected';

/**
 * Why an `error` snapshot happened. Reserved for outcomes with no
 * reconnect-automatically path — the adapter is off, or the service's own
 * scan/connect attempt didn't resolve in time or was rejected outright.
 */
export type BleConnectionErrorCause =
  | 'scanTimeout'
  | 'scanFailed' // The native scan callback reported an error, distinct from a scan timer expiry
  | 'connectTimeout'
  | 'connectRejected'
  | 'adapterOff'
  | 'unknown';

/**
 * The one payload `bleService.subscribe()` ever emits. Discriminated on
 * `state` so a consumer narrows to the fields that exist for that state
 * instead of checking optional booleans.
 */
export type BleConnectionSnapshot =
  | { state: 'idle' }
  | { state: 'scanning' }
  | { state: 'connecting'; deviceId: string }
  | { state: 'connected'; device: PairedDevice }
  | { state: 'disconnected'; device: PairedDevice; reason: BleDisconnectReason }
  | { state: 'error'; cause: BleConnectionErrorCause; message: string };
