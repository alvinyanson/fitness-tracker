import type {
  BleConnectionSnapshot,
  BleDisconnectReason,
  PairedDevice,
} from '@/interfaces/ble';

export type BleConnectionEvent =
  | { type: 'scanStarted' }
  | { type: 'scanStopped' }
  | { type: 'scanTimedOut' }
  | { type: 'connectRequested'; deviceId: string }
  | { type: 'connectSucceeded'; device: PairedDevice }
  | { type: 'connectTimedOut' }
  | { type: 'connectRejected'; message: string }
  | { type: 'connectCancelled' }
  | { type: 'disconnectRequested' }
  | { type: 'disconnected'; reason: BleDisconnectReason; device: PairedDevice }
  | { type: 'adapterPoweredOff' }
  | { type: 'reset' };

/**
 * Pure reducer for BLE connection state transitions.
 * Total function: returns `current` unchanged for any unmapped transition.
 */
export function reduceBleConnectionState(
  current: BleConnectionSnapshot,
  event: BleConnectionEvent,
): BleConnectionSnapshot {
  switch (event.type) {
    case 'scanStarted':
      if (current.state === 'idle') {
        return { state: 'scanning' };
      }
      return current;

    case 'scanStopped':
      if (current.state === 'scanning') {
        return { state: 'idle' };
      }
      return current;

    case 'scanTimedOut':
      if (current.state === 'scanning') {
        return {
          state: 'error',
          cause: 'scanTimeout',
          message: 'BLE scan timed out',
        };
      }
      return current;

    case 'connectRequested':
      if (
        current.state === 'idle' ||
        current.state === 'scanning' ||
        current.state === 'disconnected' ||
        current.state === 'error'
      ) {
        return { state: 'connecting', deviceId: event.deviceId };
      }
      return current;

    case 'connectSucceeded':
      if (current.state === 'connecting') {
        return { state: 'connected', device: event.device };
      }
      return current;

    case 'connectTimedOut':
      if (current.state === 'connecting') {
        return {
          state: 'error',
          cause: 'connectTimeout',
          message: 'Connection attempt timed out',
        };
      }
      return current;

    case 'connectRejected':
      if (current.state === 'connecting') {
        return {
          state: 'error',
          cause: 'connectRejected',
          message: event.message,
        };
      }
      return current;

    case 'connectCancelled':
      if (current.state === 'connecting') {
        return { state: 'idle' };
      }
      return current;

    case 'disconnectRequested':
      if (current.state === 'connected') {
        return {
          state: 'disconnected',
          device: current.device,
          reason: 'userInitiated',
        };
      }
      return current;

    case 'disconnected':
      if (current.state === 'connected') {
        return {
          state: 'disconnected',
          device: event.device,
          reason: event.reason,
        };
      }
      return current;

    case 'adapterPoweredOff':
      if (
        current.state === 'scanning' ||
        current.state === 'connecting' ||
        current.state === 'connected'
      ) {
        return {
          state: 'error',
          cause: 'adapterOff',
          message: 'Bluetooth adapter is powered off',
        };
      }
      return current;

    case 'reset':
      if (current.state === 'disconnected' || current.state === 'error') {
        return { state: 'idle' };
      }
      return current;

    default:
      return current;
  }
}
