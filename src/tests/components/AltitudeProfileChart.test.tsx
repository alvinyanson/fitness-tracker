import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AltitudeProfileChart } from '@/components/AltitudeProfileChart';
import type { RoutePoint } from '@/interfaces/location';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

function makePoint(
  lat: number,
  lon: number,
  altitude: number | null,
  accuracy: number | null = 5,
  timestamp = 1700000000000,
): RoutePoint {
  return {
    timestamp,
    latitude: lat,
    longitude: lon,
    altitude,
    accuracy,
  };
}

const climbPoints: RoutePoint[] = Array.from({ length: 51 }, (_, i) =>
  makePoint(
    37.77 + i * 0.001,
    -122.41,
    i * 2, // 0 to 100m
    5,
    1700000000000 + i * 2000,
  ),
);

const climbAndDescentPoints: RoutePoint[] = [
  ...Array.from({ length: 51 }, (_, i) =>
    makePoint(
      37.77 + i * 0.001,
      -122.41,
      i * 2, // 0 to 100m
      5,
      1700000000000 + i * 2000,
    ),
  ),
  ...Array.from({ length: 11 }, (_, i) =>
    makePoint(
      37.77 + (51 + i) * 0.001,
      -122.41,
      100 - i * 2, // 100 down to 80m
      5,
      1700000000000 + (51 + i) * 2000,
    ),
  ),
];

describe('AltitudeProfileChart', () => {
  beforeEach(() => {
    setLocale('en');
    useSettingsStore.setState({ language: 'en', units: 'metric' });
  });

  it('renders nothing when routePoints is empty', async () => {
    const { toJSON } = await render(<AltitudeProfileChart routePoints={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when fewer than 2 points have usable altitude', async () => {
    const { toJSON } = await render(
      <AltitudeProfileChart
        routePoints={[
          makePoint(37.77, -122.41, null),
          makePoint(37.78, -122.41, null),
        ]}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when total distance is 0', async () => {
    const { toJSON } = await render(
      <AltitudeProfileChart
        routePoints={[
          makePoint(37.7749, -122.4194, 100),
          makePoint(37.7749, -122.4194, 150),
        ]}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders header, title, and gain/loss badges for climbing route', async () => {
    const { getByText } = await render(
      <AltitudeProfileChart routePoints={climbAndDescentPoints} />,
    );

    expect(getByText('ELEVATION PROFILE')).toBeTruthy();
    expect(getByText('GAIN')).toBeTruthy();
    expect(getByText(/\+\d+\s*m/)).toBeTruthy();
    expect(getByText('LOSS')).toBeTruthy();
    expect(getByText(/-\d+\s*m/)).toBeTruthy();
  });

  it('renders the line chart and accessibility label after layout measurement', async () => {
    const root = await render(
      <AltitudeProfileChart routePoints={climbAndDescentPoints} />,
    );

    await fireEvent(root.getByTestId('altitude-profile-plot'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160 } },
    });

    const chart = root.getByTestId('altitude-profile-chart');
    expect(chart).toBeTruthy();

    const label = chart.props.accessibilityLabel;
    expect(label).toMatch(
      /Elevation profile over \d+\.\d+ km, elevation gain \d+ m, elevation loss \d+ m/,
    );
  });

  it('updates gain, loss, and accessibility label when unit system is imperial', async () => {
    useSettingsStore.setState({ language: 'en', units: 'imperial' });

    const root = await render(
      <AltitudeProfileChart routePoints={climbAndDescentPoints} />,
    );

    expect(root.getByText(/\+\d+\s*ft/)).toBeTruthy();
    expect(root.getByText(/-\d+\s*ft/)).toBeTruthy();

    await fireEvent(root.getByTestId('altitude-profile-plot'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160 } },
    });

    const chart = root.getByTestId('altitude-profile-chart');
    expect(chart.props.accessibilityLabel).toMatch(
      /Elevation profile over \d+\.\d+ mi, elevation gain \d+ ft, elevation loss \d+ ft/,
    );
  });

  it('renders localized title and labels in Japanese', async () => {
    setLocale('ja');
    useSettingsStore.setState({ language: 'ja', units: 'metric' });

    const root = await render(
      <AltitudeProfileChart routePoints={climbPoints} />,
    );

    expect(root.getByText('高度プロファイル')).toBeTruthy();
    expect(root.getByText('上昇')).toBeTruthy();
    expect(root.getByText('下降')).toBeTruthy();

    await fireEvent(root.getByTestId('altitude-profile-plot'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160 } },
    });

    const chart = root.getByTestId('altitude-profile-chart');
    expect(chart.props.accessibilityLabel).toContain('高度プロファイル');
    expect(chart.props.accessibilityLabel).toContain('上昇');
    expect(chart.props.accessibilityLabel).toContain('下降');
  });
});
