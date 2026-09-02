import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type {
  ChartDomain,
  ChartReferenceLine,
  ChartSegment,
  ChartTick,
  PlotArea,
} from '@/interfaces/chart';
import {
  computeDomain,
  scaleX,
  scaleY,
  toPolylinePoints,
} from '@/services/chart/chartSeries';
import { colors } from '@/theme';

export interface LineChartProps {
  segments: ChartSegment[];
  width: number;
  height: number;
  /** Defaults to `computeDomain(segments)`. */
  domain?: ChartDomain;
  referenceLines?: ChartReferenceLine[];
  xTicks?: ChartTick[];
  lineColor?: string;
  strokeWidth?: number;
  /** Required — the chart is one accessibility element, not a tree of nodes. */
  accessibilityLabel: string;
  testID?: string;
}

/** Layout geometry, not design: room for the tick row and breathing space. */
const TICK_GUTTER = 24;
const PLOT_INSET_Y = 6;
const TICK_FONT_SIZE = 10;
const TICK_BASELINE_OFFSET = 8;

function LineChartComponent({
  segments,
  width,
  height,
  domain,
  referenceLines,
  xTicks,
  lineColor = colors.surfaceTint,
  strokeWidth = 2,
  accessibilityLabel,
  testID,
}: LineChartProps): ReactNode {
  const resolvedDomain = domain ?? computeDomain(segments);

  if (segments.length === 0 || resolvedDomain === null || width <= 0) {
    return null;
  }

  const plot: PlotArea = {
    x: 0,
    y: PLOT_INSET_Y,
    width,
    height: Math.max(0, height - TICK_GUTTER - PLOT_INSET_Y * 2),
  };

  return (
    <View
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={width} height={height}>
          {referenceLines?.map((reference, index) => {
            const y = scaleY(reference.value, resolvedDomain, plot);
            return (
              <Line
                key={`reference-${index}`}
                testID={`${testID ?? 'line-chart'}-reference-${index}`}
                x1={plot.x}
                y1={y}
                x2={plot.x + plot.width}
                y2={y}
                stroke={reference.color}
                strokeWidth={1}
                strokeDasharray={reference.dashed ? '4,4' : undefined}
              />
            );
          })}

          {segments.map((segment, index) => {
            const single = segment.length === 1 ? segment[0] : undefined;
            if (single) {
              // A lone sample has no line to draw; a dot still shows it happened.
              return (
                <Circle
                  key={`segment-${index}`}
                  testID={`${testID ?? 'line-chart'}-point-${index}`}
                  cx={scaleX(single.x, resolvedDomain, plot)}
                  cy={scaleY(single.y, resolvedDomain, plot)}
                  r={strokeWidth}
                  fill={lineColor}
                />
              );
            }
            return (
              <Polyline
                key={`segment-${index}`}
                testID={`${testID ?? 'line-chart'}-segment-${index}`}
                points={toPolylinePoints(segment, resolvedDomain, plot)}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {xTicks?.map((tick, index) => (
            <SvgText
              key={`tick-${index}`}
              testID={`${testID ?? 'line-chart'}-tick-${index}`}
              x={scaleX(tick.value, resolvedDomain, plot)}
              y={height - TICK_BASELINE_OFFSET}
              fill={colors.onSurfaceVariant}
              fontSize={TICK_FONT_SIZE}
              // Anchor the outer ticks inward so neither is clipped by the frame.
              textAnchor={
                index === 0
                  ? 'start'
                  : index === xTicks.length - 1
                    ? 'end'
                    : 'middle'
              }
            >
              {tick.label}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}

export const LineChart = memo(LineChartComponent);
