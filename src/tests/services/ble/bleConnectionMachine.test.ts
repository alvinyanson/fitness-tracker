import type { BleConnectionSnapshot, PairedDevice } from '@/interfaces/ble';
import { reduceBleConnectionState } from '@/services/ble/bleConnectionMachine';

describe('reduceBleConnectionState', () => {
  const mockDevice: PairedDevice = { id: 'dev-123', name: 'HR Monitor' };

  it('idle + scanStarted -> scanning', () => {
    const current: BleConnectionSnapshot = { state: 'idle' };
    const next = reduceBleConnectionState(current, { type: 'scanStarted' });
    expect(next).toEqual({ state: 'scanning' });
  });

  it('scanning + scanStopped -> idle', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, { type: 'scanStopped' });
    expect(next).toEqual({ state: 'idle' });
  });

  it('scanning + scanTimedOut -> error (scanTimeout)', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, { type: 'scanTimedOut' });
    expect(next).toEqual({
      state: 'error',
      cause: 'scanTimeout',
      message: 'BLE scan timed out',
    });
  });

  it('scanning + scanFailed -> error (scanFailed) with given message', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, {
      type: 'scanFailed',
      message: 'Hardware scan failure',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'scanFailed',
      message: 'Hardware scan failure',
    });
  });

  it('scanning + scanFailed -> error (scanFailed) with default fallback message when empty', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, {
      type: 'scanFailed',
      message: '',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'scanFailed',
      message: 'BLE scan failed',
    });
  });

  it('scanning + connectRequested -> connecting', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, {
      type: 'connectRequested',
      deviceId: 'dev-123',
    });
    expect(next).toEqual({ state: 'connecting', deviceId: 'dev-123' });
  });

  it('idle + connectRequested -> connecting', () => {
    const current: BleConnectionSnapshot = { state: 'idle' };
    const next = reduceBleConnectionState(current, {
      type: 'connectRequested',
      deviceId: 'dev-123',
    });
    expect(next).toEqual({ state: 'connecting', deviceId: 'dev-123' });
  });

  it('connecting + connectRequested -> connecting with new deviceId', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectRequested',
      deviceId: 'dev-456',
    });
    expect(next).toEqual({ state: 'connecting', deviceId: 'dev-456' });
  });

  it('disconnected + connectRequested -> connecting', () => {
    const current: BleConnectionSnapshot = {
      state: 'disconnected',
      device: mockDevice,
      reason: 'userInitiated',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectRequested',
      deviceId: 'dev-123',
    });
    expect(next).toEqual({ state: 'connecting', deviceId: 'dev-123' });
  });

  it('error + connectRequested -> connecting', () => {
    const current: BleConnectionSnapshot = {
      state: 'error',
      cause: 'scanTimeout',
      message: 'BLE scan timed out',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectRequested',
      deviceId: 'dev-123',
    });
    expect(next).toEqual({ state: 'connecting', deviceId: 'dev-123' });
  });

  it('connecting + connectSucceeded -> connected', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectSucceeded',
      device: mockDevice,
    });
    expect(next).toEqual({ state: 'connected', device: mockDevice });
  });

  it('connecting + connectTimedOut -> error (connectTimeout)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, { type: 'connectTimedOut' });
    expect(next).toEqual({
      state: 'error',
      cause: 'connectTimeout',
      message: 'Connection attempt timed out',
    });
  });

  it('connecting + connectRejected -> error (connectRejected)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectRejected',
      message: 'GATT connection failed',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'connectRejected',
      message: 'GATT connection failed',
    });
  });

  it('connecting + adapterPoweredOff -> error (adapterOff)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, {
      type: 'adapterPoweredOff',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'adapterOff',
      message: 'Bluetooth adapter is powered off',
    });
  });

  it('connected + disconnectRequested -> disconnected (userInitiated)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connected',
      device: mockDevice,
    };
    const next = reduceBleConnectionState(current, {
      type: 'disconnectRequested',
    });
    expect(next).toEqual({
      state: 'disconnected',
      device: mockDevice,
      reason: 'userInitiated',
    });
  });

  it('connected + disconnected -> disconnected (unexpected)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connected',
      device: mockDevice,
    };
    const next = reduceBleConnectionState(current, {
      type: 'disconnected',
      reason: 'unexpected',
      device: mockDevice,
    });
    expect(next).toEqual({
      state: 'disconnected',
      device: mockDevice,
      reason: 'unexpected',
    });
  });

  it('connected + adapterPoweredOff -> error (adapterOff)', () => {
    const current: BleConnectionSnapshot = {
      state: 'connected',
      device: mockDevice,
    };
    const next = reduceBleConnectionState(current, {
      type: 'adapterPoweredOff',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'adapterOff',
      message: 'Bluetooth adapter is powered off',
    });
  });

  it('scanning + adapterPoweredOff -> error (adapterOff)', () => {
    const current: BleConnectionSnapshot = { state: 'scanning' };
    const next = reduceBleConnectionState(current, {
      type: 'adapterPoweredOff',
    });
    expect(next).toEqual({
      state: 'error',
      cause: 'adapterOff',
      message: 'Bluetooth adapter is powered off',
    });
  });

  it('disconnected + reset -> idle', () => {
    const current: BleConnectionSnapshot = {
      state: 'disconnected',
      device: mockDevice,
      reason: 'userInitiated',
    };
    const next = reduceBleConnectionState(current, { type: 'reset' });
    expect(next).toEqual({ state: 'idle' });
  });

  it('error + reset -> idle', () => {
    const current: BleConnectionSnapshot = {
      state: 'error',
      cause: 'scanTimeout',
      message: 'BLE scan timed out',
    };
    const next = reduceBleConnectionState(current, { type: 'reset' });
    expect(next).toEqual({ state: 'idle' });
  });

  it('connecting + connectCancelled -> idle', () => {
    const current: BleConnectionSnapshot = {
      state: 'connecting',
      deviceId: 'dev-123',
    };
    const next = reduceBleConnectionState(current, {
      type: 'connectCancelled',
    });
    expect(next).toEqual({ state: 'idle' });
  });

  describe('no-op / unchanged state pairs', () => {
    it('idle + connectCancelled -> unchanged', () => {
      const current: BleConnectionSnapshot = { state: 'idle' };
      const next = reduceBleConnectionState(current, {
        type: 'connectCancelled',
      });
      expect(next).toBe(current);
    });

    it('idle + connectSucceeded -> unchanged', () => {
      const current: BleConnectionSnapshot = { state: 'idle' };
      const next = reduceBleConnectionState(current, {
        type: 'connectSucceeded',
        device: mockDevice,
      });
      expect(next).toBe(current);
    });

    it('connected + scanStopped -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'connected',
        device: mockDevice,
      };
      const next = reduceBleConnectionState(current, { type: 'scanStopped' });
      expect(next).toBe(current);
    });

    it('scanning + disconnectRequested -> unchanged', () => {
      const current: BleConnectionSnapshot = { state: 'scanning' };
      const next = reduceBleConnectionState(current, {
        type: 'disconnectRequested',
      });
      expect(next).toBe(current);
    });

    it('idle + scanFailed -> unchanged', () => {
      const current: BleConnectionSnapshot = { state: 'idle' };
      const next = reduceBleConnectionState(current, {
        type: 'scanFailed',
        message: 'error',
      });
      expect(next).toBe(current);
    });

    it('connecting + scanFailed -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'connecting',
        deviceId: 'dev-123',
      };
      const next = reduceBleConnectionState(current, {
        type: 'scanFailed',
        message: 'error',
      });
      expect(next).toBe(current);
    });

    it('connected + scanFailed -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'connected',
        device: mockDevice,
      };
      const next = reduceBleConnectionState(current, {
        type: 'scanFailed',
        message: 'error',
      });
      expect(next).toBe(current);
    });

    it('disconnected + scanFailed -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'disconnected',
        device: mockDevice,
        reason: 'unexpected',
      };
      const next = reduceBleConnectionState(current, {
        type: 'scanFailed',
        message: 'error',
      });
      expect(next).toBe(current);
    });

    it('error + scanFailed -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'error',
        cause: 'connectTimeout',
        message: 'timed out',
      };
      const next = reduceBleConnectionState(current, {
        type: 'scanFailed',
        message: 'error',
      });
      expect(next).toBe(current);
    });

    it('connecting + connectRequested (same deviceId) -> unchanged', () => {
      const current: BleConnectionSnapshot = {
        state: 'connecting',
        deviceId: 'dev-123',
      };
      const next = reduceBleConnectionState(current, {
        type: 'connectRequested',
        deviceId: 'dev-123',
      });
      expect(next).toBe(current);
    });
  });
});
