/**
 * Rating 历史（v1.18.0）：折线图 + 统计 + 最近记录。
 * 从本版本开始记录（每次成绩同步成功一个点），不补历史；上线初期只有 1 个点是正常的。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../src/constants';
import { RatingHistoryChart } from '../src/components/RatingHistoryChart';
import { useRatingHistoryStore } from '../src/store/rating-history-store';
import {
  buildRatingHistoryShareData,
  computeRatingHistoryStats,
  formatRatingHistoryShareText,
  sliceRatingHistory,
  type RatingHistoryRange,
} from '../src/data/rating-history';
import { ShareCardOverlay } from '../src/components/ShareCardOverlay';
import { renderRatingHistoryShareCard, shareCardFileName } from '../src/data/share-card';
import { useScoreStore } from '../src/store';

const RANGE_OPTIONS: ReadonlyArray<readonly [RatingHistoryRange, string]> = [['30d', '近 30 天'], ['90d', '近 90 天'], ['all', '全部']];

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

  // v1.19.0：分享图。数据为空不显示分享入口；点太少只显示当前 Rating；图片失败给文字版。
  const profile = useScoreStore(state => state.profile);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareRange, setShareRange] = useState<RatingHistoryRange>('30d');
  const rangeLabel = RANGE_OPTIONS.find(([value]) => value === shareRange)?.[1] ?? '全部';
  const shareData = useMemo(() => {
    const sliced = sliceRatingHistory(points, shareRange);
    // 区间内没有点时退回最近一个点（只显示当前 Rating）。
    return buildRatingHistoryShareData(sliced.length > 0 ? sliced : points.slice(-1));
  }, [points, shareRange]);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Rating 历史',
          headerStyle: { backgroundColor: Colors.bg.primary },
          headerTintColor: Colors.text.primary,
          headerRight: () => (points.length > 0 ? (
            <Pressable onPress={() => setShareVisible(true)} hitSlop={8} accessibilityLabel="分享 Rating 历史">
              <Text style={styles.shareText}>分享</Text>
            </Pressable>
          ) : null),
        }}
      />
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
      {shareVisible && shareData && (
        <View style={styles.shareLayer}>
          <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map(([value, label]) => (
              <Pressable key={value} style={[styles.rangeChip, shareRange === value && styles.rangeChipActive]} onPress={() => setShareRange(value)}>
                <Text style={[styles.rangeChipText, shareRange === value && styles.rangeChipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <ShareCardOverlay
            key={shareRange}
            visible
            fileName={shareCardFileName('MaiMate-rating-history')}
            readinessDelayMs={300}
            onClose={() => setShareVisible(false)}
            card={renderRatingHistoryShareCard(shareData, rangeLabel, profile?.nickname || profile?.username)}
            fallbackText={formatRatingHistoryShareText(shareData, rangeLabel)}
          />
        </View>
      )}
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
  shareText: { fontSize: 14, fontWeight: '800', color: Colors.accent.primary, paddingHorizontal: 6 },
  shareLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30 },
  rangeRow: { position: 'absolute', top: 14, left: 0, right: 0, zIndex: 40, elevation: 40, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  rangeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.bg.secondary },
  rangeChipActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  rangeChipText: { fontSize: 12, color: Colors.text.secondary },
  rangeChipTextActive: { color: Colors.accent.primary, fontWeight: '800' },
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
