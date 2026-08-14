import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface HrZoneBarProps {
  bpm: number | null;
}

const ZONE_KEYS = [
  'workout.zones.zone1',
  'workout.zones.zone2',
  'workout.zones.zone3',
  'workout.zones.zone4',
  'workout.zones.zone5',
] as const;

export function getZoneIndex(bpm: number | null): number {
  if (bpm === null || bpm <= 0) return -1;
  if (bpm < 120) return 0;
  if (bpm < 140) return 1;
  if (bpm < 160) return 2;
  if (bpm < 180) return 3;
  return 4;
}

export function HrZoneBar({ bpm }: HrZoneBarProps): ReactNode {
  const { t } = useTranslation();
  const activeZoneIndex = getZoneIndex(bpm);

  const zoneKey =
    activeZoneIndex >= 0 && activeZoneIndex < ZONE_KEYS.length
      ? ZONE_KEYS[activeZoneIndex]
      : null;

  const zoneLabel = zoneKey ? t(zoneKey) : t('workout.zones.noData');

  return (
    <View style={styles.container}>
      {/* 5 Segment Bar */}
      <View style={styles.segmentsRow}>
        {ZONE_KEYS.map((_, index) => {
          const isActive = index === activeZoneIndex;
          return (
            <View
              key={index}
              style={[
                styles.segment,
                isActive ? styles.segmentActive : styles.segmentInactive,
              ]}
            />
          );
        })}
      </View>

      {/* Zone Title Label */}
      <Text style={styles.label}>{zoneLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    marginVertical: space.unit * 2,
  },
  segmentsRow: {
    flexDirection: 'row',
    width: '70%',
    height: 8,
    gap: space.unit,
    marginBottom: space.unit * 2,
  },
  segment: {
    flex: 1,
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentInactive: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  label: {
    color: colors.onSurface,
    fontSize: typeStyles.labelCaps.fontSize,
    fontWeight: typeStyles.labelCaps.fontWeight,
    letterSpacing: typeStyles.labelCaps.letterSpacing,
    textAlign: 'center',
  },
});
