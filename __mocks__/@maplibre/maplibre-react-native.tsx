import React, { type ReactNode } from 'react';
import { View } from 'react-native';

export const MapView = ({
  children,
  testID = 'map-view',
  ...props
}: {
  children?: ReactNode;
  testID?: string;
  [key: string]: any;
}) => (
  <View testID={testID} {...props}>
    {children}
  </View>
);

export const Camera = ({
  testID = 'map-camera',
  ...props
}: {
  testID?: string;
  [key: string]: any;
}) => <View testID={testID} {...props} />;

export const ShapeSource = ({
  children,
  testID = 'shape-source',
  ...props
}: {
  children?: ReactNode;
  testID?: string;
  [key: string]: any;
}) => (
  <View testID={testID} {...props}>
    {children}
  </View>
);

export const LineLayer = ({
  testID = 'line-layer',
  ...props
}: {
  testID?: string;
  [key: string]: any;
}) => <View testID={testID} {...props} />;

export const PointAnnotation = ({
  children,
  testID = 'point-annotation',
  ...props
}: {
  children?: ReactNode;
  testID?: string;
  [key: string]: any;
}) => (
  <View testID={testID} {...props}>
    {children}
  </View>
);

export const Map = MapView;
export const GeoJSONSource = ShapeSource;
export const Layer = LineLayer;
export const Marker = PointAnnotation;
export const ViewAnnotation = PointAnnotation;

const MapLibreGL = {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  PointAnnotation,
  Map,
  GeoJSONSource,
  Layer,
  Marker,
  ViewAnnotation,
};

export default MapLibreGL;
