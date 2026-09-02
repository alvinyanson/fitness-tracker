import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from '@/components/LineChart';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChartReferenceLine } from '@/interfaces/chart';
import type { HeartRateSample } from '@/interfaces/heartRate';
import type { SessionStats } from '@/interfaces/session';
import { buildXTicks, computeDomain } from '@/services/chart/chartSeries';
import { buildHrChartSegments } from '@/services/session/hrChartSeries';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface HrTrendChartProps {
  samples: HeartRateSample[];
  startedAt: number;
  stats: SessionStats;
}

const X_TICK_COUNT = 5;
const CHART_HEIGHT_PHONE = 160;
const CHART_HEIGHT_TABLET = 200;

export function HrTrendChart({
  samples,
  startedAt,
  stats,
}: HrTrendChartProps): ReactNode {
  const { t } = useTranslation();
  const { isTablet } = useResponsiveLayout();
  // The card sits inside `ResponsiveContent`, whose width is clamped and
  // centered, so the window width is the wrong number to scale against.
  const [chartWidth, setChartWidth] = useState(0);

  const segments = useMemo(
    () => buildHrChartSegments(samples, startedAt),
    [samples, startedAt],
  );

  const domain = useMemo(() => {
    const base = computeDomain(segments);
    if (base === null) {
      return null;
    }
    // Widen y so neither reference line is clipped off the plot.
    const references = [stats.avgHr, stats.maxHr].filter(
      (value): value is number => value !== null,
    );
    return {
      ...base,
      minY: Math.min(base.minY, ...references),
      maxY: Math.max(base.maxY, ...references),
    };
  }, [segments, stats.avgHr, stats.maxHr]);

  const xTicks = useMemo(
    () =>
      domain === null
        ? []
        : buildXTicks(domain, X_TICK_COUNT, (value) =>
            t('summary.chartMinuteTick', {
              value: Math.round(value / 60_000),
            }),
          ),
    [domain, t],
  );

  if (segments.length === 0 || domain === null) {
    return null;
  }

  const referenceLines: ChartReferenceLine[] = [];
  if (stats.avgHr !== null) {
    referenceLines.push({
      value: stats.avgHr,
      label: t('summary.hrTrendAvgLabel'),
      color: colors.primaryContainerOutline,
    });
  }
  if (stats.maxHr !== null) {
    referenceLines.push({
      value: stats.maxHr,
      label: t('summary.hrTrendMaxLabel'),
      color: colors.errorOutline,
      dashed: true,
    });
  }

  const accessibilityLabel =
    stats.avgHr !== null && stats.maxHr !== null
      ? t('summary.hrTrendAccessibility', {
          minutes: Math.round(domain.maxX / 60_000),
          avg: stats.avgHr,
          max: stats.maxHr,
        })
      : t('summary.hrTrendTitle');

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('summary.hrTrendTitle')}</Text>
        <View style={styles.legend}>
          {referenceLines.map((reference) => (
            <View key={reference.label} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  { backgroundColor: reference.color },
                ]}
              />
              <Text style={styles.legendLabel}>{reference.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.plot} onLayout={handleLayout} testID="hr-trend-plot">
        {chartWidth > 0 && (
          <LineChart
            segments={segments}
            domain={domain}
            width={chartWidth}
            height={isTablet ? CHART_HEIGHT_TABLET : CHART_HEIGHT_PHONE}
            referenceLines={referenceLines}
            xTicks={xTicks}
            accessibilityLabel={accessibilityLabel}
            testID="hr-trend-chart"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    padding: space.unit * 4,
    marginBottom: space.unit * 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.unit * 2,
  },
  title: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    lineHeight: typeStyles.labelCaps.lineHeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
  },
  legend: {
    flexDirection: 'row',
    gap: space.gridGutter,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit,
  },
  legendSwatch: {
    width: 10,
    height: 2,
    borderRadius: radii.sm,
  },
  legendLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
  },
  plot: {
    width: '100%',
  },
});
