import React from 'react';
import { Text, Button } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import type { BleConnectionSnapshot, DiscoveredDevice } from '@/interfaces/ble';
import { HEART_RATE_SERVICE_UUID } from '@/services/ble/gattProfiles';

// ── Mock bleService ──

let mockSnapshot: BleConnectionSnapshot = { state: 'idle' };
const mockListeners = new Set<(s: BleConnectionSnapshot) => void>();

function emitSnapshot(snapshot: BleConnectionSnapshot) {
  mockSnapshot = snapshot;
  for (const listener of Array.from(mockListeners)) {
    listener(snapshot);
  }
}

jest.mock('@/services/ble/bleService', () => ({
  bleService: {
    getSnapshot: jest.fn(() => mockSnapshot),
    subscribe: jest.fn((listener: (s: BleConnectionSnapshot) => void) => {
      mockListeners.add(listener);
      return () => {
        mockListeners.delete(listener);
      };
    }),
    startScan: jest.fn(),
    stopScan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    destroy: jest.fn(),
  },
}));

// ── Mock deviceStorage ──

let mockStoredDevice: { id: string; name: string | null } | null = null;

jest.mock('@/services/storage/deviceStorage', () => ({
  getLastPairedDevice: jest.fn(() => mockStoredDevice),
  setLastPairedDevice: jest.fn(
    (device: { id: string; name: string | null } | null) => {
      mockStoredDevice = device;
    },
  ),
}));

import { useDevicePairing } from '@/hooks/useDevicePairing';
import { bleService } from '@/services/ble/bleService';
import { setLastPairedDevice } from '@/services/storage/deviceStorage';

// ── Test Probe Component ──

function TestProbe() {
  const {
    connection,
    devices,
    pairedDevice,
    isScanning,
    scan,
    stopScan,
    connectToDevice,
    disconnect,
    unpair,
  } = useDevicePairing();

  return (
    <>
      <Text testID="state">{connection.state}</Text>
      <Text testID="isScanning">{String(isScanning)}</Text>
      <Text testID="deviceCount">{devices.length}</Text>
      <Text testID="pairedDevice">
        {pairedDevice ? pairedDevice.id : 'none'}
      </Text>
      {devices.map((d) => (
        <Text key={d.id} testID={`device-${d.id}`}>
          {d.name ?? 'unknown'}|{d.rssi}
        </Text>
      ))}
      <Button title="scan" onPress={scan} />
      <Button title="stopScan" onPress={stopScan} />
      <Button title="connect-dev-1" onPress={() => connectToDevice('dev-1')} />
      <Button title="disconnect" onPress={disconnect} />
      <Button title="unpair" onPress={unpair} />
    </>
  );
}

describe('useDevicePairing', () => {
  beforeEach(() => {
    mockSnapshot = { state: 'idle' };
    mockListeners.clear();
    mockStoredDevice = null;
    jest.clearAllMocks();

    // Re-bind mock implementations after clearAllMocks
    (bleService.getSnapshot as jest.Mock).mockImplementation(
      () => mockSnapshot,
    );
    (bleService.subscribe as jest.Mock).mockImplementation(
      (listener: (s: BleConnectionSnapshot) => void) => {
        mockListeners.add(listener);
        return () => {
          mockListeners.delete(listener);
        };
      },
    );
  });

  it('starts with idle connection and empty devices', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(screen.getByTestId('deviceCount')).toHaveTextContent('0');
    expect(screen.getByTestId('pairedDevice')).toHaveTextContent('none');
    expect(screen.getByTestId('isScanning')).toHaveTextContent('false');
  });

  it('scan() calls bleService.startScan with HEART_RATE_SERVICE_UUID', async () => {
    const screen = await render(<TestProbe />);

    await act(async () => {
      fireEvent.press(screen.getByText('scan'));
    });

    expect(bleService.startScan).toHaveBeenCalledWith(expect.any(Function), [
      HEART_RATE_SERVICE_UUID,
    ]);
  });

  it('scan() clears devices and accumulates discovered devices by upsert', async () => {
    const screen = await render(<TestProbe />);

    // Start scan
    await act(async () => {
      fireEvent.press(screen.getByText('scan'));
    });

    // Extract the onDeviceFound callback
    const onDeviceFound = (bleService.startScan as jest.Mock).mock
      .calls[0][0] as (device: DiscoveredDevice) => void;

    // Simulate device discovery
    await act(async () => {
      onDeviceFound({ id: 'dev-1', name: 'HR Monitor', rssi: -60 });
    });

    expect(screen.getByTestId('deviceCount')).toHaveTextContent('1');
    expect(screen.getByTestId('device-dev-1')).toHaveTextContent(
      'HR Monitor|-60',
    );

    // Upsert same device with new RSSI
    await act(async () => {
      onDeviceFound({ id: 'dev-1', name: 'HR Monitor', rssi: -45 });
    });

    expect(screen.getByTestId('deviceCount')).toHaveTextContent('1');
    expect(screen.getByTestId('device-dev-1')).toHaveTextContent(
      'HR Monitor|-45',
    );

    // Add a second device
    await act(async () => {
      onDeviceFound({ id: 'dev-2', name: 'Other', rssi: -80 });
    });

    expect(screen.getByTestId('deviceCount')).toHaveTextContent('2');
  });

  it('stopScan() calls bleService.stopScan', async () => {
    const screen = await render(<TestProbe />);

    await act(async () => {
      fireEvent.press(screen.getByText('stopScan'));
    });

    expect(bleService.stopScan).toHaveBeenCalled();
  });

  it('connectToDevice() calls bleService.connect and persists on connected', async () => {
    const screen = await render(<TestProbe />);

    // Start scan to get a device in the list
    await act(async () => {
      fireEvent.press(screen.getByText('scan'));
    });

    const onDeviceFound = (bleService.startScan as jest.Mock).mock
      .calls[0][0] as (device: DiscoveredDevice) => void;

    await act(async () => {
      onDeviceFound({ id: 'dev-1', name: 'HR Monitor', rssi: -60 });
    });

    // Connect to device
    await act(async () => {
      fireEvent.press(screen.getByText('connect-dev-1'));
    });

    expect(bleService.connect).toHaveBeenCalledWith('dev-1');

    // Simulate successful connection
    await act(async () => {
      emitSnapshot({
        state: 'connected',
        device: { id: 'dev-1', name: 'HR Monitor' },
      });
    });

    expect(screen.getByTestId('state')).toHaveTextContent('connected');
    expect(setLastPairedDevice).toHaveBeenCalledWith({
      id: 'dev-1',
      name: 'HR Monitor',
    });
    expect(screen.getByTestId('pairedDevice')).toHaveTextContent('dev-1');
  });

  it('disconnect() calls bleService.disconnect and leaves pairedDevice set', async () => {
    // Start with a paired device stored
    mockStoredDevice = { id: 'dev-1', name: 'HR Monitor' };
    const screen = await render(<TestProbe />);

    // Wait for paired device to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('pairedDevice')).toHaveTextContent('dev-1');
    });

    // Simulate connected state
    await act(async () => {
      emitSnapshot({
        state: 'connected',
        device: { id: 'dev-1', name: 'HR Monitor' },
      });
    });

    // Disconnect
    await act(async () => {
      fireEvent.press(screen.getByText('disconnect'));
    });

    expect(bleService.disconnect).toHaveBeenCalled();

    // Simulate disconnected
    await act(async () => {
      emitSnapshot({
        state: 'disconnected',
        device: { id: 'dev-1', name: 'HR Monitor' },
        reason: 'userInitiated',
      });
    });

    // pairedDevice should still be set
    expect(screen.getByTestId('pairedDevice')).toHaveTextContent('dev-1');
  });

  it('unpair() disconnects if connected and clears stored device', async () => {
    mockStoredDevice = { id: 'dev-1', name: 'HR Monitor' };
    mockSnapshot = {
      state: 'connected',
      device: { id: 'dev-1', name: 'HR Monitor' },
    };

    const screen = await render(<TestProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('pairedDevice')).toHaveTextContent('dev-1');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('unpair'));
    });

    expect(bleService.disconnect).toHaveBeenCalled();
    expect(setLastPairedDevice).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('pairedDevice')).toHaveTextContent('none');
  });

  it('auto-reconnects on mount when stored device exists and state is idle', async () => {
    mockStoredDevice = { id: 'stored-1', name: 'Saved Monitor' };
    mockSnapshot = { state: 'idle' };

    await render(<TestProbe />);

    expect(bleService.connect).toHaveBeenCalledWith('stored-1');
    expect(bleService.connect).toHaveBeenCalledTimes(1);
  });

  it('does not auto-reconnect when no stored device exists', async () => {
    mockStoredDevice = null;
    mockSnapshot = { state: 'idle' };

    await render(<TestProbe />);

    expect(bleService.connect).not.toHaveBeenCalled();
  });

  it('calls bleService.stopScan on unmount', async () => {
    const screen = await render(<TestProbe />);
    await screen.unmount();

    expect(bleService.stopScan).toHaveBeenCalled();
  });

  it('does not call bleService.destroy on unmount', async () => {
    const screen = await render(<TestProbe />);
    await screen.unmount();

    expect(bleService.destroy).not.toHaveBeenCalled();
  });
});
