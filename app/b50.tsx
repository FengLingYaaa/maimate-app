/**
 * B50 总览页（根级路由 /b50）。
 *
 * v1.12.0 重做：
 * - 删除折线图走势与「本地估算」措辞（本地口径与服务器一致）；
 * - 新曲 TOP15 / 旧曲 TOP35 分两个可切换页（SegmentedControl），池选择状态保持；
 * - 每行标注难度并按难度染色（Basic 绿/Advanced 黄/Expert 红/Master 紫/ReMaster 浅紫白）；
 * - 每个池页面末尾用提示条隔开，展示与池内最后一首同 Rating 的未入榜曲目；
 * - 明细点击跳歌曲详情，返回后保持当前池。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../src/constants';
import { CoverImage } from '../src/components/CoverImage';
import { computeB50, type B50Entry } from '../src/data/b50';
import { formatAchievement } from '../src/data/rating';
import { useMusicStore, useScoreStore } from '../src/store';

type PoolTab = 'new' | 'old';

function EntryRow({ entry, music, allSongs, onPress }: {
  entry: B50Entry;
  music?: ReturnType<ReturnType<typeof useMusicStore.getState>['musicList']['byId']>;
  allSongs: Parameters<typeof computeB50>[0];
  onPress: () => void;
}) {
  const difficultyColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
  return (
    <Pressable style={styles.entryRow} onPress={onPress}>
      <Text style={[styles.rank, entry.pool === 'new' ? styles.rankNew : styles.rankOld]}>{entry.poolRank}</Text>
      <CoverImage
        music={music ?? {
          id: entry.songId,
          title: entry.title,
          type: entry.musicType,
          ds: [],
          level: [],
          cids: [],
          charts: [],
          basic_info: { title: entry.title, artist: '', genre: '', is_new: entry.pool === 'new', bpm: 0, from: '', release_date: '' },
        }}
        allSongs={allSongs}
        style={styles.cover}
      />
      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
        <Text style={styles.entryMeta}>{entry.musicType === 'DX' ? 'DX' : 'SD'} · 定数 {entry.ds.toFixed(1)} · {formatAchievement(entry.achievement)}</Text>
      </View>
      <View style={styles.entryRight}>
        <Text style={[styles.diffChip, { color: difficultyColor, borderColor: `${difficultyColor}88`, backgroundColor: `${difficultyColor}1a` }]}>
          {DifficultyLabels[entry.difficultyIndex] || `难度 ${entry.difficultyIndex}`}
        </Text>
        <Text style={styles.entryRating}>{entry.rating}</Text>
      </View>
    </Pressable>
  );
}

export default function B50Screen() {
  const musicList = useMusicStore(state => state.musicList);
  const musicData = useMemo(() => musicList.all(), [musicList]);
  const scores = useScoreStore(state => state.scores);
  const profile = useScoreStore(state => state.profile);
  const insets = useSafeAreaInsets();

  // 池切换状态：从详情页返回后 useFocusEffect 不会重置 useState，状态天然保持。
  const [poolTab, setPoolTab] = useState<PoolTab>('new');

  const b50 = useMemo(() => computeB50(musicData, scores), [musicData, scores]);

  // 回前台时不需要重算——scores 变化会经 store 订阅自动触发 useMemo。
  useFocusEffect(useCallback(() => { /* 池选择状态保持 */ }, []));

  const poolEntries = b50.entries.filter(entry => entry.pool === poolTab);
  const ties = poolTab === 'new' ? b50.newTies : b50.oldTies;

  const openSong = useCallback((entry: B50Entry) => {
    router.push({ pathname: '/song/[id]' as const, params: { id: entry.songId, type: entry.musicType, difficultyIndex: String(entry.difficultyIndex) } });
  }, []);

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
                <Text style={styles.totalLabel}>B50 总分</Text>
              </View>
              <View style={styles.summarySide}>
                <View style={styles.summaryCard}>
                  <Text style={styles.sideValue}>{b50.newSum} <Text style={styles.sideSub}>/ 新曲 15{b50.newFull ? '' : '（未满）'}</Text></Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.sideValue}>{b50.oldSum} <Text style={styles.sideSub}>/ 旧曲 35{b50.oldFull ? '' : '（未满）'}</Text></Text>
                </View>
                {profile?.rating != null && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.sideValue}>{profile.rating} <Text style={styles.sideSub}>/ 服务器 Rating</Text></Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.poolSwitch}>
              <Pressable style={[styles.poolTab, poolTab === 'new' && styles.poolTabActive]} onPress={() => setPoolTab('new')}>
                <Text style={[styles.poolTabText, poolTab === 'new' && styles.poolTabTextActive]}>新曲 TOP15</Text>
              </Pressable>
              <Pressable style={[styles.poolTab, poolTab === 'old' && styles.poolTabActive]} onPress={() => setPoolTab('old')}>
                <Text style={[styles.poolTabText, poolTab === 'old' && styles.poolTabTextActive]}>旧曲 TOP35</Text>
              </Pressable>
            </View>

            {poolEntries.map(entry => (
              <EntryRow
                key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`}
                entry={entry}
                music={musicList.byId(entry.songId)}
                allSongs={musicData}
                onPress={() => openSong(entry)}
              />
            ))}

            {ties.length > 0 && (
              <>
                <View style={styles.tieDivider}>
                  <Text style={styles.tieDividerText}>以下 {ties.length} 首与第 {poolTab === 'new' ? 15 : 35} 名同 Rating，暂未计入总分</Text>
                </View>
                {ties.map(entry => (
                  <EntryRow
                    key={`tie-${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`}
                    entry={entry}
                    music={musicList.byId(entry.songId)}
                    allSongs={musicData}
                    onPress={() => openSong(entry)}
                  />
                ))}
              </>
            )}
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
  poolSwitch: { flexDirection: 'row', backgroundColor: Colors.bg.secondary, borderRadius: 10, padding: 3, gap: 3 },
  poolTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  poolTabActive: { backgroundColor: Colors.bg.tertiary },
  poolTabText: { fontSize: 12, fontWeight: '700', color: Colors.text.muted },
  poolTabTextActive: { color: Colors.text.primary },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  rank: { width: 24, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  rankNew: { color: Colors.accent.secondary },
  rankOld: { color: Colors.text.secondary },
  cover: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  entryInfo: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  entryMeta: { fontSize: 10, color: Colors.text.muted },
  entryRight: { alignItems: 'flex-end', gap: 3 },
  diffChip: { fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  entryRating: { fontSize: 16, fontWeight: '900', color: Colors.accent.primary },
  tieDivider: {
    alignItems: 'center',
    paddingVertical: 6,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: `${Colors.bg.tertiary}`,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  tieDividerText: { fontSize: 10, color: Colors.text.muted, fontWeight: '700' },
});
