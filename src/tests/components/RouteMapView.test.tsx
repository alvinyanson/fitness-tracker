import React from 'react';
import { render } from '@testing-library/react-native';
import { RouteMapView } from '@/components/RouteMapView';
import type { RoutePoint } from '@/interfaces/location';
import { colors } from '@/theme';

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(() => ({
    isTablet: false,
    breakpoint: 'phone',
  })),
}));

const mockPoints: RoutePoint[] = [
  {
    timestamp: 1700000000000,
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
  },
  {
    timestamp: 1700001000000,
    latitude: 37.7799,
    longitude: -122.4144,
    altitude: 15,
    accuracy: 4,
  },
  {
    timestamp: 1700002000000,
    latitude: 37.7849,
    longitude: -122.4094,
    altitude: 20,
    accuracy: 3,
  },
];

describe('RouteMapView', () => {
  it('returns null when routePoints has 0 points', async () => {
    const { queryByTestId, queryByText } = await render(
      <RouteMapView routePoints={[]} />,
    );
    expect(queryByText('ROUTE MAP')).toBeNull();
    expect(queryByTestId('route-map-view')).toBeNull();
  });

  it('returns null when routePoints has only 1 point', async () => {
    const { queryByTestId, queryByText } = await render(
      <RouteMapView routePoints={[mockPoints[0]!]} />,
    );
    expect(queryByText('ROUTE MAP')).toBeNull();
    expect(queryByTestId('route-map-view')).toBeNull();
  });

  it('returns null when fewer than 2 finite coordinates remain', async () => {
    const invalidPoints: RoutePoint[] = [
      mockPoints[0]!,
      {
        timestamp: 1700001000000,
        latitude: Number.NaN,
        longitude: -122.4144,
        altitude: 15,
        accuracy: 4,
      },
    ];
    const { queryByTestId, queryByText } = await render(
      <RouteMapView routePoints={invalidPoints} />,
    );
    expect(queryByText('ROUTE MAP')).toBeNull();
    expect(queryByTestId('route-map-view')).toBeNull();
  });

  it('renders card, title, map elements, and start/finish marker badges when routePoints >= 2', async () => {
    const { getByText, getByTestId } = await render(
      <RouteMapView routePoints={mockPoints} />,
    );

    expect(getByText('ROUTE MAP')).toBeTruthy();
    expect(getByText('Start')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();

    const mapView = getByTestId('route-map-view');
    expect(mapView).toBeTruthy();
    expect(mapView.props.scrollEnabled).toBe(false);
    expect(mapView.props.pitchEnabled).toBe(false);
    expect(mapView.props.rotateEnabled).toBe(false);
    expect(mapView.props.dragPan).toBe(false);
    expect(mapView.props.touchPitch).toBe(false);
    expect(mapView.props.touchRotate).toBe(false);
    expect(mapView.props.touchZoom).toBe(false);
    expect(mapView.props.styleURL).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    expect(mapView.props.mapStyle).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );

    const camera = getByTestId('route-camera');
    expect(camera).toBeTruthy();
    expect(camera.props.animationDuration).toBe(0);
    expect(camera.props.duration).toBe(0);
    expect(camera.props.bounds).toEqual([
      -122.4194, 37.7749, -122.4094, 37.7849,
    ]);

    const shapeSource = getByTestId('route-shape-source');
    expect(shapeSource).toBeTruthy();
    expect(shapeSource.props.id).toBe('route');
    expect(shapeSource.props.shape.geometry.coordinates).toEqual([
      [-122.4194, 37.7749],
      [-122.4144, 37.7799],
      [-122.4094, 37.7849],
    ]);
    expect(shapeSource.props.data.geometry.coordinates).toEqual([
      [-122.4194, 37.7749],
      [-122.4144, 37.7799],
      [-122.4094, 37.7849],
    ]);

    const lineLayer = getByTestId('route-line-layer');
    expect(lineLayer).toBeTruthy();
    expect(lineLayer.props.id).toBe('routeLayer');
    expect(lineLayer.props.type).toBe('line');
    expect(lineLayer.props.paint).toEqual({
      'line-color': colors.primaryContainer,
      'line-width': 4,
    });

    const startMarker = getByTestId('start-marker');
    expect(startMarker).toBeTruthy();
    expect(startMarker.props.id).toBe('start');
    expect(startMarker.props.coordinate).toEqual([-122.4194, 37.7749]);
    expect(startMarker.props.lngLat).toEqual([-122.4194, 37.7749]);
    expect(startMarker.props.anchor).toBe('bottom');
    expect(startMarker.props.title).toBe('Start');

    const startDot = getByTestId('start-marker-dot');
    const startDotStyle = Array.isArray(startDot.props.style)
      ? Object.assign({}, ...startDot.props.style)
      : startDot.props.style;
    expect(startDotStyle.backgroundColor).toBe(colors.primaryContainer);

    const endMarker = getByTestId('end-marker');
    expect(endMarker).toBeTruthy();
    expect(endMarker.props.id).toBe('end');
    expect(endMarker.props.coordinate).toEqual([-122.4094, 37.7849]);
    expect(endMarker.props.lngLat).toEqual([-122.4094, 37.7849]);
    expect(endMarker.props.anchor).toBe('bottom');
    expect(endMarker.props.title).toBe('Finish');

    const endDot = getByTestId('end-marker-dot');
    const endDotStyle = Array.isArray(endDot.props.style)
      ? Object.assign({}, ...endDot.props.style)
      : endDot.props.style;
    expect(endDotStyle.backgroundColor).toBe(colors.error);
  });

  it('adjusts map height for tablet layout', async () => {
    const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
    useResponsiveLayout.mockReturnValueOnce({
      isTablet: true,
      breakpoint: 'tablet',
    });

    const { getByTestId } = await render(
      <RouteMapView routePoints={mockPoints} />,
    );

    const mapView = getByTestId('route-map-view');
    const flatStyle = Array.isArray(mapView.props.style)
      ? Object.assign({}, ...mapView.props.style)
      : mapView.props.style;
    expect(flatStyle.height).toBe(260);
  });
});
