import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useSessionDetail, useSimplifiedRoute } from '@/hooks/useSessionDetail';
import type { RoutePoint } from '@/interfaces/location';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { HR_CHART_MAX_POINTS } from '@/services/session/hrChartSeries';
import {
  getSession,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';
import { resetDatabaseForTests } from '@/services/storage/sqliteDatabase';

const mockSession: PersistedSession = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  id: '1700000000000',
  startedAt: 1700000000000,
  endedAt: 1700003600000,
  stats: {
    durationMs: 3600000,
    avgHr: 145,
    maxHr: 175,
    minHr: 110,
    sampleCount: 3600,
    rawSampleCount: 3600,
    distanceMeters: null,
  },
  samples: [
    { timestamp: 1700000000000, bpm: 120, sensorContact: 'contactDetected' },
    { timestamp: 1700003600000, bpm: 150, sensorContact: 'contactDetected' },
  ],
};

let captured: ReturnType<typeof useSessionDetail>;

function Probe({ id }: { id: string | null }) {
  captured = useSessionDetail(id);
  return <Text>{captured.record?.id ?? 'none'}</Text>;
}

describe('useSessionDetail', () => {
  beforeEach(() => {
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
  });

  it('returns the stored record and chart samples for a known id', async () => {
    saveSession(mockSession);

    const { getByText } = await render(<Probe id="1700000000000" />);

    expect(getByText('1700000000000')).toBeTruthy();
    expect(captured.record?.stats.avgHr).toBe(145);
    expect(captured.chartSamples).toHaveLength(2);
    expect(captured.routePoints).toEqual([]);
  });

  it('returns route points loaded from storage when present', async () => {
    const mockRoutePoints = [
      {
        timestamp: 1700000000000,
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        accuracy: 5,
      },
      {
        timestamp: 1700003600000,
        latitude: 37.7849,
        longitude: -122.4094,
        altitude: 12,
        accuracy: 4,
      },
    ];
    const sessionWithRoute: PersistedSession = {
      ...mockSession,
      id: 'session-with-route',
      routePoints: mockRoutePoints,
    };
    saveSession(sessionWithRoute);

    const { getByText } = await render(<Probe id="session-with-route" />);

    expect(getByText('session-with-route')).toBeTruthy();
    expect(captured.routePoints).toEqual(mockRoutePoints);
  });

  it('returns null record and empty chart samples for an unknown id', async () => {
    const { getByText } = await render(<Probe id="does-not-exist" />);

    expect(getByText('none')).toBeTruthy();
    expect(captured.record).toBeNull();
    expect(captured.chartSamples).toEqual([]);
    expect(captured.routePoints).toEqual([]);
  });

  it('returns null record for a null id without touching storage', async () => {
    saveSession(mockSession);

    const { getByText } = await render(<Probe id={null} />);

    expect(getByText('none')).toBeTruthy();
    expect(captured.record).toBeNull();
    expect(captured.chartSamples).toEqual([]);
    expect(captured.routePoints).toEqual([]);
  });

  it('deletes the session from storage on remove', async () => {
    saveSession(mockSession);

    await render(<Probe id="1700000000000" />);

    await act(async () => {
      captured.remove();
    });

    expect(getSession('1700000000000')).toBeNull();
  });

  it('no-ops on remove when the id is null', async () => {
    saveSession(mockSession);

    await render(<Probe id={null} />);

    await act(async () => {
      captured.remove();
    });

    expect(getSession('1700000000000')).not.toBeNull();
  });

  it('reads at most HR_CHART_MAX_POINTS * 2 samples for a 3600-sample session', async () => {
    const largeSession: PersistedSession = {
      ...mockSession,
      id: 'large-session-3600',
      samples: Array.from({ length: 3600 }, (_, i) => ({
        timestamp: 1700000000000 + i * 1000,
        bpm: 130 + (i % 30),
        sensorContact: 'contactDetected',
      })),
    };
    saveSession(largeSession);

    await render(<Probe id="large-session-3600" />);

    expect(captured.record?.id).toBe('large-session-3600');
    expect(captured.chartSamples.length).toBeLessThanOrEqual(
      HR_CHART_MAX_POINTS * 2,
    );
    expect(captured.chartSamples.length).toBeGreaterThan(0);
  });

  it('useSimplifiedRoute returns GeoJSON coordinates for >= 2 points and empty for < 2', async () => {
    let simplified: [number, number][] = [];
    function RouteProbe({ points }: { points: RoutePoint[] }) {
      simplified = useSimplifiedRoute(points);
      return <Text>{String(simplified.length)}</Text>;
    }

    const { rerender } = await render(<RouteProbe points={[]} />);
    expect(simplified).toEqual([]);

    await rerender(
      <RouteProbe
        points={[
          {
            timestamp: 1700000000000,
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 10,
            accuracy: 5,
          },
          {
            timestamp: 1700001000000,
            latitude: 37.7849,
            longitude: -122.4094,
            altitude: 12,
            accuracy: 4,
          },
        ]}
      />,
    );
    expect(simplified).toEqual([
      [-122.4194, 37.7749],
      [-122.4094, 37.7849],
    ]);
  });
});
