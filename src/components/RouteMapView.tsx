import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type LineLayerProps,
  type MapViewProps,
  type PointAnnotationProps,
  type ShapeSourceProps,
} from '@maplibre/maplibre-react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSimplifiedRoute } from '@/hooks/useSessionDetail';
import { useTranslation } from '@/hooks/useTranslation';
import type { RoutePoint } from '@/interfaces/location';
import { colors, radii, space, textStyle } from '@/theme';

function MapView({
  styleURL,
  scrollEnabled,
  pitchEnabled,
  rotateEnabled,
  ...rest
}: MapViewProps): ReactNode {
  return (
    <Map
      styleURL={styleURL}
      mapStyle={rest.mapStyle ?? styleURL}
      scrollEnabled={scrollEnabled}
      pitchEnabled={pitchEnabled}
      rotateEnabled={rotateEnabled}
      dragPan={rest.dragPan ?? scrollEnabled}
      touchPitch={rest.touchPitch ?? pitchEnabled}
      touchRotate={rest.touchRotate ?? rotateEnabled}
      {...rest}
    />
  );
}

function ShapeSource({ shape, ...rest }: ShapeSourceProps): ReactNode {
  return <GeoJSONSource shape={shape} data={shape} {...rest} />;
}

function LineLayer({ style, ...rest }: LineLayerProps): ReactNode {
  const paint = style
    ? {
        ...(style.lineColor !== undefined
          ? { 'line-color': style.lineColor }
          : {}),
        ...(style.lineWidth !== undefined
          ? { 'line-width': style.lineWidth }
          : {}),
      }
    : undefined;
  return <Layer type="line" paint={paint} {...rest} />;
}

function PointAnnotation({
  coordinate,
  title,
  children,
  ...rest
}: PointAnnotationProps): ReactNode {
  const isEnd = rest.id === 'end';
  return (
    <Marker
      coordinate={coordinate}
      lngLat={coordinate}
      title={title}
      anchor="bottom"
      {...rest}
    >
      {children ?? (
        <View style={styles.markerContainer}>
          {title ? (
            <View style={styles.markerBadge}>
              <Text style={styles.markerLabel}>{title}</Text>
            </View>
          ) : null}
          <View
            testID={rest.id ? `${rest.id}-marker-dot` : undefined}
            style={[
              styles.markerDot,
              {
                backgroundColor: isEnd ? colors.error : colors.primaryContainer,
              },
            ]}
          />
        </View>
      )}
    </Marker>
  );
}

export interface RouteMapViewProps {
  routePoints: RoutePoint[];
}

const DEMO_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const CAMERA_PADDING = { top: 32, right: 32, bottom: 32, left: 32 };

/** Renders route polyline and markers on MapLibre; returns null if < 2 points. */
export function RouteMapView({ routePoints }: RouteMapViewProps): ReactNode {
  const { t } = useTranslation();
  const { isTablet } = useResponsiveLayout();
  const coordinates = useSimplifiedRoute(routePoints);

  const mapData = useMemo(() => {
    if (coordinates.length < 2) {
      return null;
    }

    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    if (minLng === maxLng) {
      minLng -= 0.001;
      maxLng += 0.001;
    }
    if (minLat === maxLat) {
      minLat -= 0.001;
      maxLat += 0.001;
    }

    const bounds: [number, number, number, number] = [
      minLng,
      minLat,
      maxLng,
      maxLat,
    ];

    const shape = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates,
      },
    };

    return {
      bounds,
      lineStringGeoJson: shape,
      startCoord: coordinates[0]!,
      endCoord: coordinates[coordinates.length - 1]!,
    };
  }, [coordinates]);

  if (!mapData) {
    return null;
  }

  const mapHeight = isTablet ? 260 : 200;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('summary.routeMapTitle')}
        </Text>
      </View>

      <View style={[styles.mapFrame, { height: mapHeight }]}>
        <MapView
          style={[styles.map, { height: mapHeight }]}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          dragPan={false}
          touchPitch={false}
          touchRotate={false}
          touchZoom={false}
          styleURL={DEMO_STYLE_URL}
          mapStyle={DEMO_STYLE_URL}
          testID="route-map-view"
          accessibilityLabel={t('summary.routeMapTitle')}
        >
          <Camera
            bounds={mapData.bounds}
            animationDuration={0}
            duration={0}
            padding={CAMERA_PADDING}
            testID="route-camera"
          />
          <ShapeSource
            id="route"
            shape={mapData.lineStringGeoJson}
            testID="route-shape-source"
          >
            <LineLayer
              id="routeLayer"
              style={{
                lineColor: colors.primaryContainer,
                lineWidth: 4,
              }}
              testID="route-line-layer"
            />
          </ShapeSource>
          <PointAnnotation
            id="start"
            coordinate={mapData.startCoord}
            title={t('summary.startMarker')}
            testID="start-marker"
          />
          <PointAnnotation
            id="end"
            coordinate={mapData.endCoord}
            title={t('summary.endMarker')}
            testID="end-marker"
          />
        </MapView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space.unit * 4,
    marginBottom: space.unit * 4,
  },
  header: {
    marginBottom: space.unit * 2,
  },
  title: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelCaps'),
  },
  mapFrame: {
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBadge: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: space.unit * 1.5,
    paddingVertical: space.unit * 0.5,
    marginBottom: space.unit * 0.5,
  },
  markerLabel: {
    color: colors.onSurface,
    ...textStyle('labelCaps'),
  },
  markerDot: {
    width: space.unit * 3,
    height: space.unit * 3,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
});
