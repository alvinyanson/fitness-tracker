import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from '@/components/LineChart';
import { useAltitudeProfile } from '@/hooks/useAltitudeProfile';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTranslation } from '@/hooks/useTranslation';
import type { RoutePoint } from '@/interfaces/location';
import { colors, radii, space, textStyle } from '@/theme';

export interface AltitudeProfileChartProps {
  routePoints: RoutePoint[];
}

const CHART_HEIGHT_PHONE = 160;
const CHART_HEIGHT_TABLET = 200;

export function AltitudeProfileChart({
  routePoints,
}: AltitudeProfileChartProps): ReactNode {
  const { t } = useTranslation();
  const { isTablet } = useResponsiveLayout();
  const [chartWidth, setChartWidth] = useState(0);

  const profile = useAltitudeProfile(routePoints);

  if (profile === null || profile.totalDistance <= 0) {
    return null;
  }

  const chartHeight = isTablet ? CHART_HEIGHT_TABLET : CHART_HEIGHT_PHONE;

  const accessibilityLabel = t('summary.altitudeProfileAccessibility', {
    distance: profile.totalDistance.toFixed(1),
    distanceUnit: profile.distanceUnit,
    gain: profile.gain,
    elevationUnit: profile.elevationUnit,
    loss: profile.loss,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card} testID="altitude-profile-card">
      <View style={styles.header}>
        <Text style={styles.title}>{t('summary.altitudeProfileTitle')}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>
              {t('summary.elevationGainLabel')}
            </Text>
            <Text style={styles.statValue}>
              +{profile.gain} {profile.elevationUnit}
            </Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>
              {t('summary.elevationLossLabel')}
            </Text>
            <Text style={styles.statValue}>
              -{profile.loss} {profile.elevationUnit}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[styles.plot, { minHeight: chartHeight }]}
        onLayout={handleLayout}
        testID="altitude-profile-plot"
      >
        {chartWidth > 0 && (
          <LineChart
            segments={profile.segments}
            domain={profile.domain}
            width={chartWidth}
            height={chartHeight}
            xTicks={profile.xTicks}
            lineColor={colors.surfaceTint}
            accessibilityLabel={accessibilityLabel}
            testID="altitude-profile-chart"
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
    ...textStyle('labelCaps'),
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.gridGutter,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit,
  },
  statLabel: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelCaps'),
  },
  statValue: {
    color: colors.onSurface,
    ...textStyle('labelCaps'),
  },
  plot: {
    width: '100%',
  },
});
