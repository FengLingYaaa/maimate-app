/**
 * B50 总览页（v1.11.0 新增，根级路由 /b50）。
 *
 * - 本地按 Diving-Fish 口径估算 B50：旧曲 TOP35 + 新曲 TOP15；
 * - 顶部展示总分、两池合计与官方 Rating 对照；
 * - 基于 ≤6 次本地快照绘制 B50 走势折线（本地估算 + 服务器 RA 双线）；
 * - 明细列表展示每张谱面的定数/达成率/单谱 Rating 与曲绘。
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Colors } from '../src/constants';
import { CoverImage } from '../src/components/CoverImage';
import { computeB50 } from '../src/data/b50';
import { formatAchievement } from '../src/data/rating';
import { useMusicStore, useScoreStore } from '../src/store';
import type { MusicData, PlayerScore } from '../src/data/types';

const CHART_HEIGHT = 132;
const CHART_WIDTH = 320;

function buildTrend(
  musicData: MusicData[],
  snapshots: Array<{ syncedAt: number; scores: PlayerScore[]; serverRating: number | null }>,
  currentScores: PlayerScore[],
  currentServerRating: number | null,
): Array<{ label: string; local: number; server: number | null }> {
  const points = snapshots.map(snapshot => ({
    label: new Date(snapshot.syncedAt).toLocaleDateString(undefined, { 'month': 'numeric', 'day': 'numeric' }),
    local: computeB50(musicData, snapshot.scores).total,
    server: snapshot.serverRating,
  }));
  points.push({
    label: '当前',
    local: computeB50(musicData, currentScores).total,
    server: currentServerRating,
  });
  return points;
}

export default function B50Screen() {
  const musicList = useMusicStore(state => state.musicList);
  const musicData = useMemo(() => musicList.all(), [musicList]);
  const scores = useScoreStore(state => state.scores);
  const snapshots = useScoreStore(state => state.snapshots);
  const profile = useScoreStore(state => state.profile);
  const insets = useSafeAreaInsets();

  const b50 = useMemo(() => computeB50(musicData, scores), [musicData, scores]);
  const trend = useMemo(
    () => buildTrend(musicData, snapshots, scores, profile?.rating ?? null),
    [musicData, snapshots, scores, profile],
  );

  const chart = useMemo(() => {
    if (trend.length < 2) return null;
    const localValues = trend.map(point => point.local);
    const serverValues = trend.map(point => point.server).filter((value): value is number => value !== null);
    const all = [...localValues, ...serverValues];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = Math.max(max - min, 30);
    const stepX = CHART_WIDTH / (trend.length - 1);
    const toXY = (value: number, index: number) => {
      const x = index * stepX;
      const y = CHART_HEIGHT - ((value - min) / span) * (CHART_HEIGHT - 16) - 8;
      return { x, y };
    };
    return {
      labels: trend.map(point => point.label),
      localPoints: localValues.map(toXY),
      serverPoints: serverValues.length === trend.length ? serverValues.map(toXY) : null,
    };
  }, [trend]);

  const hasScores = scores.length > 0;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>B50 总览</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasScores ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>尚未导入成绩</Text>
            <Text style={styles.emptyText}>先在「设置 → Diving-Fish 成绩导入」配置 Token 并同步成绩，再来查看你的 B50。</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.totalCard]}>
                <Text style={styles.totalValue}>{b50.total}</Text>
                <Text style={styles.totalLabel}>本地估算 B50</Text>
              </View>
              <View style={styles.summarySide}>
                <View style={styles.summaryCard}>
                  <Text style={styles.sideValue}>{b50.oldSum} <Text style={styles.sideSub}>/ 旧曲 B35{b50.oldFull ? '' : '（未满）'}</Text></Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.sideValue}>{b50.newSum} <Text style={styles.sideSub}>/ 新曲 B15{b50.newFull ? '' : '（未满）'}</Text></Text>
                </View>
                {profile?.rating != null && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.sideValue}>{profile.rating} <Text style={styles.sideSub}>/ 服务器 Rating</Text></Text>
                  </View>
                )}
              </View>
            </View>

            {chart && (
              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>B50 走势（最多最近 6 次同步）</Text>
                <View style={styles.chartWrap}>
                  <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chartSvg}>
                    {chart.serverPoints && (
                      <Polyline
                        points={chart.serverPoints.map(point => `${point.x},${point.y}`).join(' ')}
                        fill="none"
                        stroke={Colors.accent.secondary}
                        strokeWidth={1.6}
                        strokeDasharray="4 3"
                      />
                    )}
                    <Polyline
                      points={chart.localPoints.map(point => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke={Colors.accent.primary}
                      strokeWidth={2.2}
                    />
                    {chart.localPoints.map((point, index) => (
                      <Circle key={index} cx={point.x} cy={point.y} r={3} fill={Colors.accent.primary} />
                    ))}
                  </Svg>
                  <View style={styles.chartLabels}>
                    {chart.labels.map((label, index) => (
                      <Text key={`${label}-${index}`} style={styles.chartLabel}>{label}</Text>
                    ))}
                  </View>
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.accent.primary }]} /><Text style={styles.legendText}>本地估算</Text></View>
                  {chart.serverPoints && <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: Colors.accent.secondary }]} /><Text style={styles.legendText}>服务器 RA</Text></View>}
                </View>
                {snapshots.length < 2 && <Text style={styles.chartHint}>快照不足 2 次，多点同步几次就能看到完整曲线。</Text>}
              </View>
            )}

            <Text style={styles.cardTitle}>B50 明细（新曲 15 + 旧曲 35）</Text>
            {b50.entries.map(entry => (
              <Pressable
                key={`${entry.pool}-${entry.poolRank}`}
                style={styles.entryRow}
                onPress={() => router.push(`/song/${entry.songId}` as const)}
              >
                <Text style={[styles.rank, entry.pool === 'new' ? styles.rankNew : styles.rankOld]}>{entry.rank}</Text>
                <CoverImage
                  music={musicList.byId(entry.songId) ?? {
                    id: entry.songId,
                    title: entry.title,
                    type: entry.musicType,
                    ds: [],
                    level: [],
                    cids: [],
                    charts: [],
                    basic_info: { title: entry.title, artist: '', genre: '', is_new: entry.pool === 'new', bpm: 0, from: '', release_date: '' },
                  }}
                  style={styles.cover}
                />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
                  <Text style={styles.entryMeta}>
                    {entry.musicType === 'DX' ? 'DX' : 'SD'} · {'Master Remaster Expert Advanced Basic'.split(' ')[Math.min(entry.difficultyIndex, 4)]} · 定数 {entry.ds.toFixed(1)}
                  </Text>
                  <Text style={styles.entryMeta}>{formatAchievement(entry.achievement)}</Text>
                </View>
                <Text style={styles.entryRating}>{entry.rating}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: { width: 48, alignItems: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '700', color: Colors.accent.secondary },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  content: { padding: 14, gap: 12 },
  emptyCard: { backgroundColor: Colors.bg.secondary, borderRadius: 14, padding: 18, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  emptyText: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { backgroundColor: Colors.bg.secondary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  totalCard: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalValue: { fontSize: 30, fontWeight: '900', color: Colors.accent.primary },
  totalLabel: { fontSize: 10, color: Colors.text.muted, marginTop: 2 },
  summarySide: { flex: 1, gap: 8 },
  sideValue: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  sideSub: { fontSize: 10, fontWeight: '500', color: Colors.text.muted },
  chartCard: { backgroundColor: Colors.bg.secondary, borderRadius: 14, padding: 12, gap: 8 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  chartWrap: { alignItems: 'center' },
  chartSvg: { backgroundColor: Colors.bg.tertiary, borderRadius: 10 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginTop: 4 },
  chartLabel: { fontSize: 9, color: Colors.text.muted },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: Colors.text.secondary },
  chartHint: { fontSize: 10, color: Colors.text.muted },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  rank: { width: 26, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  rankNew: { color: Colors.accent.secondary },
  rankOld: { color: Colors.text.secondary },
  cover: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  entryInfo: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  entryMeta: { fontSize: 10, color: Colors.text.muted },
  entryRating: { fontSize: 16, fontWeight: '900', color: Colors.accent.primary, minWidth: 44, textAlign: 'right' },
});
