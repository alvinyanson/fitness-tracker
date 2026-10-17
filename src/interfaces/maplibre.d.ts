import '@maplibre/maplibre-react-native';
import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

declare module '@maplibre/maplibre-react-native' {
  export interface MapViewProps {
    style?: StyleProp<ViewStyle>;
    styleURL?: string;
    mapStyle?: string | object;
    scrollEnabled?: boolean;
    pitchEnabled?: boolean;
    rotateEnabled?: boolean;
    dragPan?: boolean;
    touchPitch?: boolean;
    touchRotate?: boolean;
    touchZoom?: boolean;
    children?: ReactNode;
    testID?: string;
    accessibilityLabel?: string;
  }

  export interface CameraProps {
    bounds?:
      | [west: number, south: number, east: number, north: number]
      | {
          ne: [number, number];
          sw: [number, number];
          paddingBottom?: number;
          paddingLeft?: number;
          paddingRight?: number;
          paddingTop?: number;
        };
    animationDuration?: number;
    duration?: number;
    padding?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    testID?: string;
  }

  export interface ShapeSourceProps {
    id: string;
    shape?: unknown;
    data?: unknown;
    children?: ReactNode;
    testID?: string;
  }

  export interface LineLayerProps {
    id: string;
    type?: string;
    style?: {
      lineColor?: string;
      lineWidth?: number;
      [key: string]: unknown;
    };
    paint?: Record<string, unknown>;
    testID?: string;
  }

  export interface PointAnnotationProps {
    id: string;
    coordinate?: [number, number];
    lngLat?: [number, number];
    anchor?: string;
    title?: string;
    children?: ReactNode;
    testID?: string;
  }

  export const MapView: ComponentType<MapViewProps>;
  export const Map: ComponentType<MapViewProps>;
  export const Camera: ComponentType<CameraProps>;
  export const ShapeSource: ComponentType<ShapeSourceProps>;
  export const GeoJSONSource: ComponentType<ShapeSourceProps>;
  export const LineLayer: ComponentType<LineLayerProps>;
  export const Layer: ComponentType<LineLayerProps>;
  export const PointAnnotation: ComponentType<PointAnnotationProps>;
  export const Marker: ComponentType<PointAnnotationProps>;
  export const ViewAnnotation: ComponentType<PointAnnotationProps>;
}
