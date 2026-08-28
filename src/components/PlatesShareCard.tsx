/**
 * 牌子完成度分享卡（v1.15.2）：深色卡片，显示当前筛选（版本/难度/最低等级）下
 * 谱面总数与 FC/SSS/FS/AP 四类牌子达成数与百分比，附各难度分行。
 * 由牌子页 ShareCardOverlay 按需渲染捕获。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import type { DifficultyPlateSummary, PlateSummary } from '../data/plates';

interface Props {
  summary: PlateSummary;
  byDifficulty: DifficultyPlateSummary[];
  /** 当前筛选描述（如「真骨头 2024 · Master」），展示在卡片头部。 */
  filterLabel: string;
  userName?: string;
}

const PLATE_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'FC', label: 'FC', color: '#3dd68c' },
  { key: 'SSS', label: 'SSS', color: '#ffd166' },
  { key: 'FSD', label: 'FS', color: '#00d4ff' },
  { key: 'AP', label: 'AP', color: '#ff6b9d' },
];

export function PlatesShareCard({ summary, byDifficulty, filterLabel, userName }: Props) {
  const pct = (value: number) => (summary.total > 0 ? ((value / summary.total) * 100).toFixed(1) : '0.0');
  const filteredRows = byDifficulty.filter(row => row.total > 0);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · 牌子完成度</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalValue}>{summary.total}</Text>
          <Text style={styles.totalLabel}>谱面</Text>
        </View>
      </View>

      <Text style={styles.filterLine}>{filterLabel}</Text>

      <View style={styles.chipsRow}>
        {PLATE_META.map(({ key, label, color }) => (
          <View key={key} style={styles.chip}>
            <Text style={[styles.chipValue, { color }]}>{summary.counts[key as keyof typeof summary.counts] ?? 0}</Text>
            <Text style={styles.chipLabel}>{label} · {pct(summary.counts[key as keyof typeof summary.counts] ?? 0)}%</Text>
          </View>
        ))}
      </View>

      {filteredRows.length > 0 && (
        <View style={styles.diffRows}>
          {filteredRows.map(row => (
            <View key={row.difficultyIndex} style={styles.diffRow}>
              <Text style={[styles.diffLabel, { color: DifficultyColorMap[row.difficultyIndex] || Colors.accent.secondary }]}>
                {DifficultyLabels[row.difficultyIndex] || `难度${row.difficultyIndex}`}
              </Text>
              <Text style={styles.diffCounts}>
                {PLATE_META.map(({ key, label }) => `${label} ${row.counts[key as keyof typeof row.counts] ?? 0}`).join('  ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>maimate.flya.ccwu.cc</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 344,
    backgroundColor: '#14142b',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName: { fontSize: 13, fontWeight: '900', color: '#ff6b9d' },
  userName: { fontSize: 11, color: '#9888b0', marginTop: 2 },
  totalWrap: { alignItems: 'flex-end' },
  totalValue: { fontSize: 30, fontWeight: '900', color: '#f0e6ff' },
  totalLabel: { fontSize: 9, color: '#9888b0' },
  filterLine: { fontSize: 10, color: '#00d4ff', fontWeight: '700' },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: '#1e1e38', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  chipValue: { fontSize: 16, fontWeight: '900' },
  chipLabel: { fontSize: 8.5, color: '#9888b0', marginTop: 1 },
  diffRows: { gap: 4 },
  diffRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1e1e38', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
  },
  diffLabel: { width: 52, fontSize: 10.5, fontWeight: '900' },
  diffCounts: { flex: 1, fontSize: 10, color: '#c8bce0' },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
