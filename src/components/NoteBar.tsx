/**
 * NoteBar — Note 分布可视化条
 * 横向色块展示 TAP/HOLD/SLIDE/TOUCH/BREAK 占比
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants';
import { getNoteBreakdown } from '../data/music-list';
import type { ChartData } from '../data/types';

interface Props {
  chart: ChartData;
  isDX: boolean;
  compact?: boolean;
}

const NOTE_COLORS = {
  tap: '#ff6b9d',
  hold: '#fdd835',
  slide: '#4d8dff',
  touch: '#43a047',
  brk: '#ff9800',
};

const NOTE_LABELS = ['TAP', 'HOLD', 'SLIDE', 'TOUCH', 'BREAK'];

export function NoteBar({ chart, isDX, compact = false }: Props) {
  const notes = getNoteBreakdown(chart, isDX);
  const total = notes.tap + notes.hold + notes.slide + notes.touch + notes.brk;
  if (total === 0) return null;

  const segments = [
    { label: 'TAP', value: notes.tap, color: NOTE_COLORS.tap },
    { label: 'HOLD', value: notes.hold, color: NOTE_COLORS.hold },
    { label: 'SLIDE', value: notes.slide, color: NOTE_COLORS.slide },
    ...(isDX ? [{ label: 'TOUCH', value: notes.touch, color: NOTE_COLORS.touch }] : []),
    { label: 'BREAK', value: notes.brk, color: NOTE_COLORS.brk },
  ].filter(s => s.value > 0);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bar, compact && styles.barCompact]}>
        {segments.map((seg, i) => (
          <View
            key={seg.label}
            style={[
              styles.segment,
              {
                flex: seg.value,
                backgroundColor: seg.color,
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === segments.length - 1 ? 4 : 0,
              },
            ]}
          />
        ))}
      </View>
      {!compact && (
        <View style={styles.legend}>
          {segments.map(seg => (
            <View key={seg.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendText}>{seg.label}: {seg.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barCompact: {
    height: 6,
  },
  segment: {
    height: '100%',
    minWidth: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
});