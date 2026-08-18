import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors } from '../constants';
import { calculateRating, RATING_CHECKPOINTS } from '../data/rating';

interface Props {
  ds: number;
  fitDiff?: number;
  loading?: boolean;
}

export function RatingPanel({ ds, fitDiff, loading = false }: Props) {
  const [achievement, setAchievement] = useState(100);
  const checkpoints = useMemo(
    () => RATING_CHECKPOINTS.map(rate => ({
      rate,
      official: calculateRating(ds, rate),
      fitted: fitDiff === undefined ? null : calculateRating(fitDiff, rate),
    })),
    [ds, fitDiff],
  );
  const official = calculateRating(ds, achievement);
  const fitted = fitDiff === undefined ? null : calculateRating(fitDiff, achievement);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>DX Rating 预估</Text>
        {loading && <Text style={styles.loading}>拟合数据加载中…</Text>}
      </View>
      <Text style={styles.caption}>官方定数和拟合定数分别计算，实际机器 Rating 可能受版本规则影响。</Text>
      <View style={styles.rateHeader}>
        <Text style={styles.rateLabel}>完成率</Text>
        <Text style={styles.rateValue}>{achievement.toFixed(1)}%</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={50}
        maximumValue={100.5}
        step={0.1}
        value={achievement}
        minimumTrackTintColor={Colors.accent.primary}
        maximumTrackTintColor={Colors.bg.tertiary}
        thumbTintColor={Colors.accent.primary}
        onValueChange={value => setAchievement(Number(value.toFixed(1)))}
      />
      <View style={styles.currentRow}>
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>官方 DX Rating</Text>
          <Text style={styles.currentValue}>{official ?? '—'}</Text>
        </View>
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>拟合 Rating</Text>
          <Text style={[styles.currentValue, styles.fittedValue]}>{fitted ?? '—'}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
        <View>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.headerCell]}>完成率</Text>
            <Text style={[styles.cell, styles.headerCell]}>官方</Text>
            <Text style={[styles.cell, styles.headerCell]}>拟合</Text>
          </View>
          {checkpoints.map(row => (
            <View key={row.rate} style={styles.tableRow}>
              <Text style={styles.cell}>{row.rate.toFixed(1)}%</Text>
              <Text style={styles.cell}>{row.official ?? '—'}</Text>
              <Text style={[styles.cell, styles.fittedValue]}>{row.fitted ?? '—'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  loading: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  caption: {
    fontSize: 10,
    lineHeight: 15,
    color: Colors.text.muted,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  slider: {
    height: 30,
  },
  currentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currentBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.bg.secondary,
  },
  currentLabel: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  currentValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  fittedValue: {
    color: Colors.accent.secondary,
  },
  tableScroll: {
    marginTop: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  tableHeader: {
    borderBottomColor: Colors.border.medium,
  },
  cell: {
    width: 78,
    paddingVertical: 5,
    fontSize: 10,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  headerCell: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
});