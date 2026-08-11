import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, space, type as typeStyles } from '@/theme';

export interface HrZoneBarProps {
  bpm: number | null;
}

interface ZoneInfo {
  name: string;
  minBpm: number;
}

const ZONES: ZoneInfo[] = [
  { name: 'ZONE 1: WARMUP', minBpm: 0 },
  { name: 'ZONE 2: EASY', minBpm: 120 },
  { name: 'ZONE 3: AEROBIC', minBpm: 140 },
  { name: 'ZONE 4: ANAEROBIC', minBpm: 160 },
  { name: 'ZONE 5: REDLINE', minBpm: 180 },
];

export function getZoneIndex(bpm: number | null): number {
  if (bpm === null || bpm <= 0) return -1;
  if (bpm < 120) return 0;
  if (bpm < 140) return 1;
  if (bpm < 160) return 2;
  if (bpm < 180) return 3;
  return 4;
}

export function HrZoneBar({ bpm }: HrZoneBarProps): ReactNode {
  const activeZoneIndex = getZoneIndex(bpm);

  const zoneLabel =
    activeZoneIndex >= 0 ? ZONES[activeZoneIndex].name : 'ZONE --: NO DATA';

  return (
    <View style={styles.container}>
      {/* 5 Segment Bar */}
      <View style={styles.segmentsRow}>
        {ZONES.map((_, index) => {
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
