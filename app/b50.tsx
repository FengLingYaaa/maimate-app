/**
 * B50 总览 / 拟合 50（根级路由 /b50，v1.15.0 起双模式）。
 *
 * - B50 模式：新曲 15 + 旧曲 35 官方口径；拟合 50 模式：按拟合定数 Rating 的全库单榜 50。
 * - 列表/网格切换、池/排序切换、长按多选入计划（自绘工具栏）、完成率着色+底纹、分享卡。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../src/constants';
import { B50ShareCard } from '../src/components/B50ShareCard';
import { Fit50ShareCard } from '../src/components/Fit50ShareCard';
import { ShareCardOverlay } from '../src/components/ShareCardOverlay';
import {
  RatingEntryRow,
  RatingGridCell,
  RatingTieDivider,
  b50ToUnified,
  fitToUnified,
} from '../src/components/RatingGrid';
import { computeB50 } from '../src/data/b50';
import { computeFit50, sortFit50Entries, type Fit50Sort } from '../src/data/fit50';
import { shareCardFileName } from '../src/data/share-card';
import { useMusicStore, usePlanStore, useScoreStore } from '../src/store';

type ScreenMode = 'b50' | 'fit50';
type PoolTab = 'new' | 'old';
type ViewMode = 'list' | 'grid';

export default function B50Screen() {
  const rawData = useMusicStore(state => state.rawData);
  const chartStats = useMusicStore(state => state.chartStats);
  const chartStatsLoading = useMusicStore(state => state.chartStatsLoading);
  const scores = useScoreStore(state => state.scores);
  const profile = useScoreStore(state => state.profile);
  const bulkAddEntries = usePlanStore(state => state.bulkAddEntries);
  const isInPlan = usePlanStore(state => state.isInPlan);
  const insets = useSafeAreaInsets();

  const [screenMode, setScreenMode] = useState<ScreenMode>('b50');
  const [poolTab, setPoolTab] = useState<PoolTab>('new');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fitSort, setFitSort] = useState<Fit50Sort>('rating');
  const [shareVisible, setShareVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const b50 = useMemo(() => computeB50(rawData, scores), [rawData, scores]);
  const fit50 = useMemo(() => computeFit50(rawData, scores, chartStats), [rawData, scores, chartStats]);

  const b50PoolEntries = useMemo(
    () => b50.entries.filter(entry => entry.pool === poolTab).map(b50ToUnified),
    [b50, poolTab],
  );
  const b50Ties = useMemo(
    () => (poolTab === 'new' ? b50.newTies : b50.oldTies).map(b50ToUnified),
    [b50, poolTab],
  );
  const fitEntries = useMemo(
    () => sortFit50Entries(fit50.entries, fitSort).map(fitToUnified),
    [fit50, fitSort],
  );

  const mainEntries = screenMode === 'b50' ? b50PoolEntries : fitEntries;
  const ties = screenMode === 'b50' ? b50Ties : [];
  const allGridEntries = useMemo(
    () => (screenMode === 'b50' ? [...b50PoolEntries, ...b50Ties] : fitEntries),
    [b50PoolEntries, b50Ties, fitEntries, screenMode],
  );

  const openSong = useCallback((entry: { songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number }) => {
    router.push({ pathname: '/song/[id]' as const, params: { id: entry.songId, type: entry.musicType, difficultyIndex: String(entry.difficultyIndex) } });
  }, []);

  const enterSelection = useCallback((firstEntry: { key: string }) => {
    const initial = new Set<string>();
    for (const item of allGridEntries) {
      if (isInPlan(item.songId, item.difficultyIndex, item.musicType)) initial.add(item.key);
    }
    initial.add(firstEntry.key);
    setSelectedKeys(initial);
    setSelectionMode(true);
  }, [allGridEntries, isInPlan]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  }, []);

  const toggleEntry = useCallback((entry: { key: string }) => {
    setSelectedKeys(previous => {
      const next = new Set(previous);
      if (next.has(entry.key)) next.delete(entry.key);
      else next.add(entry.key);
      return next;
    });
  }, []);

  const commitSelection = useCallback(() => {
    const byKey = new Map(allGridEntries.map(entry => [entry.key, entry]));
    const pending: Array<{ songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number }> = [];
    for (const key of selectedKeys) {
      const entry = byKey.get(key);
      if (!entry) continue;
      if (isInPlan(entry.songId, entry.difficultyIndex, entry.musicType)) continue;
      pending.push({ songId: entry.songId, musicType: entry.musicType, difficultyIndex: entry.difficultyIndex });
    }
    const newlyAdded = bulkAddEntries(pending);
    const skipped = pending.length - newlyAdded.length;
    setBulkNotice(newlyAdded.length > 0
      ? `已加入 ${newlyAdded.length} 首到推分计划${skipped > 0 ? `（${skipped} 首已在计划中，已跳过）` : ''}`
      : '所选曲目都已在计划中');
    exitSelection();
  }, [allGridEntries, bulkAddEntries, isInPlan, selectedKeys, exitSelection]);

  useEffect(() => {
    if (!selectionMode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelection();
      return true;
    });
    return () => subscription.remove();
  }, [selectionMode, exitSelection]);

  useEffect(() => {
    if (!bulkNotice) return;
    const timer = setTimeout(() => setBulkNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [bulkNotice]);

  const hasScores = scores.length > 0;
  const showSelectionToolbar = selectionMode && viewMode === 'grid';
  const musicFor = (entry: { songId: string; musicType: string }) =>
    rawData.find(candidate => candidate.id === entry.songId && candidate.type === entry.musicType);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => (selectionMode ? exitSelection() : router.back())}
          hitSlop={8}
        >
          <Text style={styles.backText}>{selectionMode ? '取消' : '‹ 返回'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{screenMode === 'b50' ? 'B50 总览' : '拟合 50'}</Text>
        <View style={styles.headerRight}>
          {hasScores && (
            <Pressable style={styles.shareButton} onPress={() => setShareVisible(true)} accessibilityLabel="分享卡片">
              <Text style={styles.shareButtonText}>分享</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.viewToggle}
            onPress={() => setViewMode(mode => (mode === 'list' ? 'grid' : 'list'))}
            accessibilityLabel={viewMode === 'list' ? '切换到网格模式' : '切换到列表模式'}
          >
            <Text style={styles.viewToggleText}>{viewMode === 'list' ? '⊞' : '☰'}</Text>
          </Pressable>
        </View>
      </View>

      {/* v1.15.1：B50 / 拟合 50 模式 segment（顶栏标题下方）。 */}
      {hasScores && !selectionMode && (
        <View style={styles.modeSegmentRow}>
          <View style={styles.modeSegment}>
            <Pressable
              style={[styles.modeSegmentTab, screenMode === 'b50' && styles.modeSegmentTabActive]}
              onPress={() => setScreenMode('b50')}
            >
              <Text style={[styles.modeSegmentText, screenMode === 'b50' && styles.modeSegmentTextActive]}>B50 总览</Text>
            </Pressable>
            <Pressable
              style={[styles.modeSegmentTab, screenMode === 'fit50' && styles.modeSegmentTabActive]}
              onPress={() => setScreenMode('fit50')}
            >
              <Text style={[styles.modeSegmentText, screenMode === 'fit50' && styles.modeSegmentTextActive]}>拟合 50</Text>
            </Pressable>
          </View>
        </View>
      )}

      {hasScores && shareVisible && (
        <ShareCardOverlay
          visible
          fileName={shareCardFileName(screenMode === 'b50' ? 'MaiMate-b50' : 'MaiMate-fit50')}
          onClose={() => setShareVisible(false)}
          card={screenMode === 'b50' ? (
            <B50ShareCard
              rawData={rawData}
              scores={scores}
              serverRating={profile?.rating ?? null}
              userName={profile?.nickname ?? profile?.username}
            />
          ) : (
            <Fit50ShareCard
              rawData={rawData}
              scores={scores}
              chartStats={chartStats}
              serverRating={profile?.rating ?? null}
              userName={profile?.nickname ?? profile?.username}
            />
          )}
        />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {!hasScores ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>尚未导入成绩</Text>
            <Text style={styles.emptyText}>先在「设置 → Diving-Fish 成绩导入」配置 Token 并同步成绩，再来查看榜单。</Text>
            <Text style={styles.emptyText}>拟合 50 依赖拟合定数数据，浏览任意歌曲详情页即可自动缓存全库拟合定数。</Text>
          </View>
        ) : (
          <>
            {screenMode === 'b50' ? (
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
            ) : (
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, styles.totalCard]}>
                  <Text style={styles.totalValue}>{fit50.total}</Text>
                  <Text style={styles.totalLabel}>拟合 50 总分</Text>
                </View>
                <View style={styles.summarySide}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.sideValue}>{fit50.entries.length}<Text style={styles.sideSub}> / 50 谱面</Text></Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.sideValue}>{fit50.chartsWithFitDiff}<Text style={styles.sideSub}> / 有拟合定数成绩</Text></Text>
                  </View>
                </View>
              </View>
            )}

            {screenMode === 'fit50' && fit50.entries.length < 50 && chartStatsLoading && (
              <View style={styles.bulkNoticeBar}>
                <Text style={styles.bulkNoticeText}>拟合定数加载中，榜单暂不完整…</Text>
              </View>
            )}

            {showSelectionToolbar ? (
              <View style={styles.selectionToolbar}>
                <Pressable style={styles.selectionButton} onPress={() => setSelectedKeys(new Set(allGridEntries.map(entry => entry.key)))}>
                  <Text style={styles.selectionButtonText}>全选</Text>
                </Pressable>
                <Text style={styles.selectionCount}>已选 {selectedKeys.size} 首</Text>
                <Pressable style={styles.selectionButtonGhost} onPress={exitSelection}>
                  <Text style={styles.selectionButtonGhostText}>取消</Text>
                </Pressable>
                <Pressable style={styles.selectionButtonPrimary} onPress={commitSelection}>
                  <Text style={styles.selectionButtonPrimaryText}>加入计划</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.toolbarRow}>
                <View style={styles.poolSwitch}>
                  {screenMode === 'b50' ? (
                    <>
                      <Pressable style={[styles.poolTab, poolTab === 'new' && styles.poolTabActive]} onPress={() => setPoolTab('new')}>
                        <Text style={[styles.poolTabText, poolTab === 'new' && styles.poolTabTextActive]}>新曲 TOP15</Text>
                      </Pressable>
                      <Pressable style={[styles.poolTab, poolTab === 'old' && styles.poolTabActive]} onPress={() => setPoolTab('old')}>
                        <Text style={[styles.poolTabText, poolTab === 'old' && styles.poolTabTextActive]}>旧曲 TOP35</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={[styles.poolTab, fitSort === 'rating' && styles.poolTabActive]} onPress={() => setFitSort('rating')}>
                        <Text style={[styles.poolTabText, fitSort === 'rating' && styles.poolTabTextActive]}>按 Rating</Text>
                      </Pressable>
                      <Pressable style={[styles.poolTab, fitSort === 'fitDiff' && styles.poolTabActive]} onPress={() => setFitSort('fitDiff')}>
                        <Text style={[styles.poolTabText, fitSort === 'fitDiff' && styles.poolTabTextActive]}>按拟合定数</Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {viewMode === 'grid' && <Text style={styles.gridHint}>长按多选</Text>}
              </View>
            )}

            {bulkNotice && (
              <View style={styles.bulkNoticeBar}>
                <Text style={styles.bulkNoticeText}>{bulkNotice}</Text>
              </View>
            )}

            {viewMode === 'list' ? (
              <>
                {mainEntries.map(entry => (
                  <RatingEntryRow
                    key={entry.key}
                    entry={entry}
                    music={musicFor(entry)}
                    allSongs={rawData}
                    onPress={() => openSong(entry)}
                  />
                ))}
                {screenMode === 'b50' && ties.length > 0 && (
                  <>
                    <RatingTieDivider count={ties.length} poolLastRank={poolTab === 'new' ? 15 : 35} />
                    {ties.map(entry => (
                      <RatingEntryRow
                        key={`tie-${entry.key}`}
                        entry={entry}
                        music={musicFor(entry)}
                        allSongs={rawData}
                        onPress={() => openSong(entry)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <View key={`grid-${screenMode}-${poolTab}`} style={styles.gridWrap}>
                {mainEntries.map(entry => (
                  <RatingGridCell
                    key={entry.key}
                    entry={entry}
                    music={musicFor(entry)}
                    allSongs={rawData}
                    selectionMode={selectionMode}
                    selected={selectedKeys.has(entry.key)}
                    onPress={() => (selectionMode ? toggleEntry(entry) : openSong(entry))}
                    onLongPress={() => (selectionMode ? toggleEntry(entry) : enterSelection(entry))}
                  />
                ))}
                {screenMode === 'b50' && ties.length > 0 && (
                  <>
                    <View style={styles.gridTieDivider}>
                      <Text style={styles.gridTieDividerText}>以下 {ties.length} 首与第 {poolTab === 'new' ? 15 : 35} 名同 Rating，暂未计入总分</Text>
                    </View>
                    {ties.map(entry => (
                      <RatingGridCell
                        key={`tie-${entry.key}`}
                        entry={entry}
                        music={musicFor(entry)}
                        allSongs={rawData}
                        selectionMode={selectionMode}
                        selected={selectedKeys.has(entry.key)}
                        onPress={() => (selectionMode ? toggleEntry(entry) : openSong(entry))}
                        onLongPress={() => (selectionMode ? toggleEntry(entry) : enterSelection(entry))}
                      />
                    ))}
                  </>
                )}
              </View>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: `${Colors.accent.primary}22`,
    borderWidth: 1,
    borderColor: Colors.accent.primary,
  },
  shareButtonText: { fontSize: 11, fontWeight: '800', color: Colors.accent.primary },
  viewToggle: {
    width: 40,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  viewToggleText: { fontSize: 16, color: Colors.text.primary },
  modeSegmentRow: { paddingHorizontal: 14, paddingTop: 10 },
  modeSegment: { flexDirection: 'row', backgroundColor: Colors.bg.secondary, borderRadius: 10, padding: 3, gap: 3 },
  modeSegmentTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  modeSegmentTabActive: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  modeSegmentText: { fontSize: 12.5, fontWeight: '700', color: Colors.text.muted },
  modeSegmentTextActive: { color: Colors.accent.primary },
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
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolSwitch: { flex: 1, flexDirection: 'row', backgroundColor: Colors.bg.secondary, borderRadius: 10, padding: 3, gap: 3 },
  poolTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  poolTabActive: { backgroundColor: Colors.bg.tertiary },
  poolTabText: { fontSize: 12, fontWeight: '700', color: Colors.text.muted },
  poolTabTextActive: { color: Colors.text.primary },
  gridHint: { fontSize: 9, color: Colors.text.muted, marginLeft: 8 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  gridTieDivider: {
    width: '100%' as any,
    alignItems: 'center',
    paddingVertical: 6,
    marginVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  gridTieDividerText: { fontSize: 10, color: Colors.text.muted, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  selectionToolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg.secondary, borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: Colors.accent.primary,
  },
  selectionButton: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light,
  },
  selectionButtonText: { fontSize: 11, fontWeight: '800', color: Colors.text.secondary },
  selectionCount: { flex: 1, fontSize: 12, fontWeight: '800', color: Colors.text.primary, textAlign: 'center' },
  selectionButtonGhost: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  selectionButtonGhostText: { fontSize: 11, fontWeight: '800', color: Colors.text.muted },
  selectionButtonPrimary: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.accent.primary },
  selectionButtonPrimaryText: { fontSize: 11, fontWeight: '900', color: '#1a0a14' },
  bulkNoticeBar: {
    alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: 9, backgroundColor: `${Colors.functional.success}22`,
    borderWidth: 1, borderColor: `${Colors.functional.success}66`,
  },
  bulkNoticeText: { fontSize: 11, fontWeight: '700', color: Colors.functional.success },
});
