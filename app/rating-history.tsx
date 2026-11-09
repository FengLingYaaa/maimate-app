/**
 * Rating 历史（v1.18.0）：折线图 + 统计 + 最近记录。
 * 从本版本开始记录（每次成绩同步成功一个点），不补历史；上线初期只有 1 个点是正常的。
 */

import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../src/constants';
import { RatingHistoryChart } from '../src/components/RatingHistoryChart';
import { useRatingHistoryStore } from '../src/store/rating-history-store';
import { computeRatingHistoryStats } from '../src/data/rating-history';

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  if (value > 0) return `+${value}`;
  return String(value);
}

function deltaColor(value: number | null): string {
  if (value === null || value === 0) return Colors.text.primary;
  return value > 0 ? Colors.functional.success : Colors.functional.danger;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RatingHistoryPage() {
  const points = useRatingHistoryStore(state => state.points);
  const loaded = useRatingHistoryStore(state => state.loaded);
  const load = useRatingHistoryStore(state => state.load);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const stats = useMemo(() => computeRatingHistoryStats(points), [points]);
  const recent = useMemo(() => points.slice(-10).reverse(), [points]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Rating 历史', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headline}>
          <Text style={styles.headlineLabel}>当前 Rating</Text>
          <Text style={styles.headlineValue}>{stats.latest ?? '—'}</Text>
          <Text style={styles.headlineSub}>共记录 {stats.count} 次同步</Text>
        </View>

        <View style={styles.card}>
          <RatingHistoryChart points={points} />
          {points.length === 1 && (
            <Text style={styles.hint}>已开始记录。下次同步成绩后会连成曲线。</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCell label="最高 Rating" value={stats.max === null ? '—' : String(stats.max)} />
          <StatCell label="最低 Rating" value={stats.min === null ? '—' : String(stats.min)} />
          <StatCell label="7 日变化" value={formatDelta(stats.change7d)} color={deltaColor(stats.change7d)} />
          <StatCell label="30 日变化" value={formatDelta(stats.change30d)} color={deltaColor(stats.change30d)} />
        </View>

        {recent.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>最近记录</Text>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.cellTime, styles.headText]}>时间</Text>
              <Text style={[styles.cellNum, styles.headText]}>Rating</Text>
              <Text style={[styles.cellNum, styles.headText]}>B50</Text>
              <Text style={[styles.cellNum, styles.headText]}>曲目</Text>
            </View>
            {recent.map((point, index) => {
              const previous = recent[index + 1];
              const delta = previous ? point.totalRating - previous.totalRating : null;
              return (
                <View key={point.at} style={styles.tableRow}>
                  <Text style={styles.cellTime}>{formatTime(point.at)}</Text>
                  <Text style={styles.cellNum}>
                    {point.totalRating}
                    {delta !== null && delta !== 0 && (
                      <Text style={{ color: deltaColor(delta) }}> {formatDelta(delta)}</Text>
                    )}
                  </Text>
                  <Text style={styles.cellNum}>{point.b50Rating}</Text>
                  <Text style={styles.cellNum}>{point.songCount}</Text>
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.note}>每次成功同步 Diving-Fish 成绩记录一个点；同一天 Rating 没变不重复记录。Rating 为 Diving-Fish 账号 Rating，B50 为本机按同口径计算的结果。</Text>
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  headline: { alignItems: 'flex-start', gap: 2, paddingHorizontal: 4 },
  headlineLabel: { fontSize: 11, color: Colors.text.muted },
  headlineValue: { fontSize: 34, fontWeight: '900', color: Colors.text.primary },
  headlineSub: { fontSize: 11, color: Colors.text.secondary },
  card: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 10, gap: 6, borderWidth: 1, borderColor: Colors.border.light },
  cardTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary, marginBottom: 2 },
  hint: { fontSize: 11, color: Colors.text.muted, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, backgroundColor: Colors.bg.secondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  statValue: { fontSize: 16, fontWeight: '900', color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.muted, marginTop: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.light },
  tableHead: { paddingTop: 0 },
  headText: { fontSize: 10, fontWeight: '800', color: Colors.text.muted },
  cellTime: { flex: 1.3, fontSize: 12, color: Colors.text.secondary },
  cellNum: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.text.primary, textAlign: 'right' },
  note: { fontSize: 10, lineHeight: 16, color: Colors.text.muted, paddingHorizontal: 4 },
});
