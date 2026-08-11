import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { BleConnectionSnapshot, DiscoveredDevice } from '@/interfaces/ble';

// ── Mock bleService ──
// jest.mock factories run before any variable declarations in the module,
// so we use __mocks or define the mock shape inline.

let mockSnapshot: BleConnectionSnapshot = { state: 'idle' };
const mockListeners = new Set<(s: BleConnectionSnapshot) => void>();

function mockEmitSnapshot(snapshot: BleConnectionSnapshot) {
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
    connect: jest.fn((deviceId: string) => {
      mockEmitSnapshot({ state: 'connecting', deviceId });
    }),
    cancelConnect: jest.fn(),
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

// Import after mocks are set up
import PairingScreen from '@/app/index';
import * as blePermissionGateModule from '@/services/ble/blePermissionGate';
import { bleService } from '@/services/ble/bleService';

describe('PairingScreen', () => {
  beforeEach(() => {
    mockSnapshot = { state: 'idle' };
    mockListeners.clear();
    mockStoredDevice = null;
    jest.clearAllMocks();

    // Re-bind getSnapshot to return current mockSnapshot
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Permission gate tests (unchanged) ──

  it('renders permission denied message and handles retry when status is permissionDenied', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('permissionDenied');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Bluetooth Permission Required')).toBeTruthy();
    });

    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();
  });

  it('renders permission blocked message and opens settings when status is permissionBlocked', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('permissionBlocked');
    const openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(async () => {});

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Permission Permanently Denied')).toBeTruthy();
    });

    const settingsButton = getByText('Open Settings');
    fireEvent.press(settingsButton);

    expect(openSettingsSpy).toHaveBeenCalled();
  });

  it('renders bluetooth off message when status is bluetoothOff', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('bluetoothOff');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Bluetooth is Turned Off')).toBeTruthy();
    });
  });

  // ── Ready state: pairing UI tests ──

  it('renders pairing UI with scan button and navigation links when ready', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Scan')).toBeTruthy();
      expect(getByText('DEVICE PAIRING')).toBeTruthy();
    });
  });

  it('renders idle empty-state message when not scanning', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Tap Scan to search for nearby devices')).toBeTruthy();
    });
  });

  it('shows scanning status and empty-state after tapping Scan', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Scan')).toBeTruthy();
    });

    // Start scan
    await act(async () => {
      fireEvent.press(getByText('Scan'));
    });

    expect(bleService.startScan).toHaveBeenCalled();

    // Simulate scanning state
    await act(async () => {
      mockEmitSnapshot({ state: 'scanning' });
    });

    expect(getByText('Scanning…')).toBeTruthy();
    expect(getByText('Stop Scan')).toBeTruthy();
    expect(getByText('Searching for nearby heart rate monitors…')).toBeTruthy();
  });

  it('scan → discover device → tap → connected flow', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Scan')).toBeTruthy();
    });

    // Start scan
    await act(async () => {
      fireEvent.press(getByText('Scan'));
    });

    // Extract onDeviceFound callback and simulate device discovery
    const onDeviceFound = (bleService.startScan as jest.Mock).mock
      .calls[0][0] as (device: DiscoveredDevice) => void;

    await act(async () => {
      mockEmitSnapshot({ state: 'scanning' });
    });

    await act(async () => {
      onDeviceFound({ id: 'dev-1', name: 'HR Monitor', rssi: -60 });
    });

    expect(getByText('HR Monitor')).toBeTruthy();
    expect(getByText('-60 dBm')).toBeTruthy();

    // Tap on discovered device
    await act(async () => {
      fireEvent.press(getByText('HR Monitor'));
    });

    expect(bleService.connect).toHaveBeenCalledWith('dev-1');

    // Simulate connected state
    await act(async () => {
      mockEmitSnapshot({
        state: 'connected',
        device: { id: 'dev-1', name: 'HR Monitor' },
      });
    });

    expect(getByText('Connected')).toBeTruthy();
    expect(getByText('Paired Device')).toBeTruthy();
  });

  it('auto-reconnects on mount when a paired device exists', async () => {
    mockStoredDevice = { id: 'stored-1', name: 'Saved Monitor' };

    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    await render(<PairingScreen />);

    await waitFor(() => {
      expect(bleService.connect).toHaveBeenCalledWith('stored-1');
    });
  });

  it('auto-reconnect renders connected UI without user tapping Scan', async () => {
    mockStoredDevice = { id: 'stored-1', name: 'Saved Monitor' };

    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(bleService.connect).toHaveBeenCalledWith('stored-1');
    });

    // Simulate connecting/connected states
    await act(async () => {
      mockEmitSnapshot({
        state: 'connected',
        device: { id: 'stored-1', name: 'Saved Monitor' },
      });
    });

    expect(getByText('Connected')).toBeTruthy();
    expect(getByText('Paired Device')).toBeTruthy();
  });

  it('mount with stored device renders Reconnecting… and visible Cancel button', async () => {
    mockStoredDevice = { id: 'stored-1', name: 'Saved Monitor' };

    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText, queryByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(bleService.connect).toHaveBeenCalledWith('stored-1');
    });

    await act(async () => {
      mockEmitSnapshot({ state: 'connecting', deviceId: 'stored-1' });
    });

    expect(getByText('Reconnecting…')).toBeTruthy();
    expect(queryByText('Connecting…')).toBeNull();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('tapping Cancel during auto-reconnect calls bleService.cancelConnect and returns to idle UI', async () => {
    mockStoredDevice = { id: 'stored-1', name: 'Saved Monitor' };

    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText, queryByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(bleService.connect).toHaveBeenCalledWith('stored-1');
    });

    await act(async () => {
      mockEmitSnapshot({ state: 'connecting', deviceId: 'stored-1' });
    });

    expect(getByText('Cancel')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });

    expect(bleService.cancelConnect).toHaveBeenCalled();

    await act(async () => {
      mockEmitSnapshot({ state: 'idle' });
    });

    expect(getByText('Pairing')).toBeTruthy();
    expect(queryByText('Reconnecting…')).toBeNull();
    expect(queryByText('Cancel')).toBeNull();
    expect(getByText('Scan')).toBeTruthy();
    expect(getByText('Saved Monitor')).toBeTruthy();
  });

  it('manual device tap renders Connecting… with no Cancel button', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText, queryByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Scan')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Scan'));
    });

    const onDeviceFound = (bleService.startScan as jest.Mock).mock
      .calls[0][0] as (device: DiscoveredDevice) => void;

    await act(async () => {
      mockEmitSnapshot({ state: 'scanning' });
    });

    await act(async () => {
      onDeviceFound({ id: 'dev-1', name: 'HR Monitor', rssi: -60 });
    });

    await act(async () => {
      fireEvent.press(getByText('HR Monitor'));
    });

    await act(async () => {
      mockEmitSnapshot({ state: 'connecting', deviceId: 'dev-1' });
    });

    expect(getByText('Connecting…')).toBeTruthy();
    expect(queryByText('Reconnecting…')).toBeNull();
    expect(queryByText('Cancel')).toBeNull();
  });

  it('renders error state distinctly from idle', async () => {
    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Pairing')).toBeTruthy();
    });

    await act(async () => {
      mockEmitSnapshot({
        state: 'error',
        cause: 'connectTimeout',
        message: 'Connection attempt timed out',
      });
    });

    expect(getByText('Error: Connection attempt timed out')).toBeTruthy();
  });

  it('renders disconnected state with paired device card still visible', async () => {
    mockStoredDevice = { id: 'dev-1', name: 'HR Monitor' };

    jest
      .spyOn(blePermissionGateModule, 'evaluateBlePermissionGate')
      .mockResolvedValue('ready');

    const { getByText } = await render(<PairingScreen />);

    await waitFor(() => {
      expect(getByText('Paired Device')).toBeTruthy();
    });

    await act(async () => {
      mockEmitSnapshot({
        state: 'disconnected',
        device: { id: 'dev-1', name: 'HR Monitor' },
        reason: 'unexpected',
      });
    });

    expect(getByText('Disconnected')).toBeTruthy();
    expect(getByText('Paired Device')).toBeTruthy();
  });
});
