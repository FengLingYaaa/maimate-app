/**
 * B50 总览页（根级路由 /b50）。
 *
 * v1.13.0：
 * - 数据源改为 rawData（全量曲库），B50 不再受曲库筛选影响（修复 v1.12 bug）；
 * - 新增网格模式（与列表模式切换，状态保持）：每行 5 首曲绘，难度色边框，
 *   左下定数、右下 Rating、正下方完成率；长按曲绘快捷加入推分计划；
 * - 列表模式保持 v1.12 行为。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../src/constants';
import { CoverImage } from '../src/components/CoverImage';
import { B50ShareCard } from '../src/components/B50ShareCard';
import { ShareCardOverlay } from '../src/components/ShareCardOverlay';
import { computeB50, achievementTier, ACHIEVEMENT_TIER_COLORS, type B50Entry } from '../src/data/b50';
import { shareCardFileName } from '../src/data/share-card';
import { formatAchievement } from '../src/data/rating';
import { useMusicStore, usePlanStore, useScoreStore } from '../src/store';
import type { MusicData } from '../src/data/types';

type PoolTab = 'new' | 'old';
type ViewMode = 'list' | 'grid';

function EntryRow({ entry, music, allSongs, onPress }: {
  entry: B50Entry;
  music?: MusicData;
  allSongs: MusicData[];
  onPress: () => void;
}) {
  const difficultyColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
  return (
    <Pressable style={styles.entryRow} onPress={onPress}>
      <Text style={[styles.rank, entry.pool === 'new' ? styles.rankNew : styles.rankOld]}>{entry.poolRank}</Text>
      <CoverImage
        music={music ?? fallbackMusic(entry)}
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

function GridCell({ entry, music, allSongs, selectionMode, selected, onPress, onLongPress }: {
  entry: B50Entry;
  music?: MusicData;
  allSongs: MusicData[];
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const borderColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
  const tier = achievementTier(entry.achievement);
  const achievementColor = ACHIEVEMENT_TIER_COLORS[tier];
  return (
    <Pressable style={styles.gridCell} onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      <View style={[styles.gridCoverWrap, { borderColor }, selectionMode && selected && styles.gridCoverSelected]}>
        <CoverImage
          music={music ?? fallbackMusic(entry)}
          allSongs={allSongs}
          style={styles.gridCover}
        />
        <View style={styles.gridCornerLeft}><Text style={styles.gridCornerText}>{entry.ds.toFixed(1)}</Text></View>
        <View style={styles.gridCornerRight}><Text style={styles.gridCornerText}>{entry.rating}</Text></View>
        {selectionMode && (
          <View style={[styles.gridCheckbox, selected && styles.gridCheckboxChecked]}>
            {selected && <Text style={styles.gridCheckboxMark}>✓</Text>}
          </View>
        )}
      </View>
      <Text style={[styles.gridAchievement, { color: achievementColor }]} numberOfLines={1}>{formatAchievement(entry.achievement)}</Text>
    </Pressable>
  );
}

/** 网格模式：正榜与同分附加曲目之间的分隔条。 */
function GridTieDivider({ count, pool }: { count: number; pool: PoolTab }) {
  return (
    <View style={styles.gridTieDivider}>
      <Text style={styles.gridTieDividerText}>以下 {count} 首与第 {pool === 'new' ? 15 : 35} 名同 Rating，暂未计入总分</Text>
    </View>
  );
}

function fallbackMusic(entry: B50Entry): MusicData {
  return {
    id: entry.songId,
    title: entry.title,
    type: entry.musicType,
    ds: [],
    level: [],
    cids: [],
    charts: [],
    basic_info: { title: entry.title, artist: '', genre: '', is_new: entry.pool === 'new', bpm: 0, from: '', release_date: '' },
  };
}

export default function B50Screen() {
  const rawData = useMusicStore(state => state.rawData);
  const scores = useScoreStore(state => state.scores);
  const profile = useScoreStore(state => state.profile);
  const bulkAddEntries = usePlanStore(state => state.bulkAddEntries);
  const isInPlan = usePlanStore(state => state.isInPlan);
  const insets = useSafeAreaInsets();

  // 池/视图模式状态：返回后保持。
  const [poolTab, setPoolTab] = useState<PoolTab>('new');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [shareVisible, setShareVisible] = useState(false);

  // v1.14.0：网格长按多选入计划。
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const entryKeyOf = useCallback((entry: B50Entry) => `${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`, []);

  const b50 = useMemo(() => computeB50(rawData, scores), [rawData, scores]);

  const poolEntries = b50.entries.filter(entry => entry.pool === poolTab);
  const ties = poolTab === 'new' ? b50.newTies : b50.oldTies;
  const allGridEntries = useMemo(() => [...poolEntries, ...ties], [poolEntries, ties]);

  const openSong = useCallback((entry: B50Entry) => {
    router.push({ pathname: '/song/[id]' as const, params: { id: entry.songId, type: entry.musicType, difficultyIndex: String(entry.difficultyIndex) } });
  }, []);

  const enterSelection = useCallback((firstEntry: B50Entry) => {
    const initial = new Set<string>();
    for (const item of [...b50.entries, ...b50.newTies, ...b50.oldTies]) {
      if (isInPlan(item.songId, item.difficultyIndex, item.musicType)) {
        initial.add(entryKeyOf(item));
      }
    }
    initial.add(entryKeyOf(firstEntry));
    setSelectedKeys(initial);
    setSelectionMode(true);
  }, [b50, entryKeyOf, isInPlan]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  }, []);

  const toggleEntry = useCallback((entry: B50Entry) => {
    const key = entryKeyOf(entry);
    setSelectedKeys(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [entryKeyOf]);

  // 提交多选：跳过已在计划中的，返回新增数量（0 表示全部已存在）。
  const commitSelection = useCallback(() => {
    const byKey = new Map(allGridEntries.map(entry => [entryKeyOf(entry), entry]));
    const pending: B50Entry[] = [];
    for (const key of selectedKeys) {
      const entry = byKey.get(key);
      if (!entry) continue;
      if (isInPlan(entry.songId, entry.difficultyIndex, entry.musicType)) continue;
      pending.push(entry);
    }
    const newlyAdded = bulkAddEntries(pending.map(entry => ({
      songId: entry.songId, difficultyIndex: entry.difficultyIndex, musicType: entry.musicType,
    })));
    const skipped = pending.length - newlyAdded.length;
    setBulkNotice(newlyAdded.length > 0
      ? `已加入 ${newlyAdded.length} 首到推分计划${skipped > 0 ? `（${skipped} 首已在计划中，已跳过）` : ''}`
      : '所选曲目都已在计划中');
    exitSelection();
  }, [allGridEntries, bulkAddEntries, entryKeyOf, exitSelection, isInPlan, selectedKeys]);

  // 选择模式下 Android 返回键先退选择，不退出页面。
  useEffect(() => {
    if (!selectionMode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelection();
      return true;
    });
    return () => subscription.remove();
  }, [selectionMode, exitSelection]);

  // 批量结果提示 2.6s 自动消失。
  useEffect(() => {
    if (!bulkNotice) return;
    const timer = setTimeout(() => setBulkNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [bulkNotice]);

  const hasScores = scores.length > 0;

  // 选择模式下的工具栏（替换池切换行，含全选/加入/取消）。
  const selectionToolbar = selectionMode && viewMode === 'grid' && (
    <View style={styles.selectionToolbar}>
      <Pressable
        style={styles.selectionButton}
        onPress={() => setSelectedKeys(new Set(allGridEntries.map(entryKeyOf)))}
      >
        <Text style={styles.selectionButtonText}>全选</Text>
      </Pressable>
      <Text style={styles.selectionCount}>
        已选 {selectedKeys.size} 首
      </Text>
      <Pressable style={styles.selectionButtonGhost} onPress={exitSelection}>
        <Text style={styles.selectionButtonGhostText}>取消</Text>
      </Pressable>
      <Pressable style={styles.selectionButtonPrimary} onPress={commitSelection}>
        <Text style={styles.selectionButtonPrimaryText}>加入计划</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => (selectionMode ? exitSelection() : router.back())}
          hitSlop={8}
        >
          <Text style={styles.backText}>{selectionMode ? '取消' : '‹ 返回'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>B50 总览</Text>
        <View style={styles.headerRight}>
          {hasScores && (
            <Pressable
              style={styles.shareButton}
              onPress={() => setShareVisible(true)}
              accessibilityLabel="分享 B50 卡片"
            >
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

      {hasScores && shareVisible && (
        <ShareCardOverlay
          visible
          fileName={shareCardFileName('MaiMate-b50')}
          onClose={() => setShareVisible(false)}
          card={(
            <B50ShareCard
              rawData={rawData}
              scores={scores}
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

            {selectionToolbar ?? (
              <View style={styles.toolbarRow}>
                <View style={styles.poolSwitch}>
                  <Pressable style={[styles.poolTab, poolTab === 'new' && styles.poolTabActive]} onPress={() => setPoolTab('new')}>
                    <Text style={[styles.poolTabText, poolTab === 'new' && styles.poolTabTextActive]}>新曲 TOP15</Text>
                  </Pressable>
                  <Pressable style={[styles.poolTab, poolTab === 'old' && styles.poolTabActive]} onPress={() => setPoolTab('old')}>
                    <Text style={[styles.poolTabText, poolTab === 'old' && styles.poolTabTextActive]}>旧曲 TOP35</Text>
                  </Pressable>
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
                {poolEntries.map(entry => (
                  <EntryRow
                    key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`}
                    entry={entry}
                    music={rawData.find(music => music.id === entry.songId && music.type === entry.musicType)}
                    allSongs={rawData}
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
                        music={rawData.find(music => music.id === entry.songId && music.type === entry.musicType)}
                        allSongs={rawData}
                        onPress={() => openSong(entry)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <View key={`grid-${poolTab}`} style={styles.gridWrap}>
                {poolEntries.map(entry => (
                  <GridCell
                    key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`}
                    entry={entry}
                    music={rawData.find(music => music.id === entry.songId && music.type === entry.musicType)}
                    allSongs={rawData}
                    selectionMode={selectionMode}
                    selected={selectedKeys.has(entryKeyOf(entry))}
                    onPress={() => (selectionMode ? toggleEntry(entry) : openSong(entry))}
                    onLongPress={() => (selectionMode ? toggleEntry(entry) : enterSelection(entry))}
                  />
                ))}
                {ties.length > 0 && <GridTieDivider count={ties.length} pool={poolTab} />}
                {ties.map(entry => (
                  <GridCell
                    key={`tie-${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`}
                    entry={entry}
                    music={rawData.find(music => music.id === entry.songId && music.type === entry.musicType)}
                    allSongs={rawData}
                    selectionMode={selectionMode}
                    selected={selectedKeys.has(entryKeyOf(entry))}
                    onPress={() => (selectionMode ? toggleEntry(entry) : openSong(entry))}
                    onLongPress={() => (selectionMode ? toggleEntry(entry) : enterSelection(entry))}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const CELL_GAP = 6;
const CELL_SIZE = 60;

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
  viewToggle: {
    width: 40,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
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
  viewToggleText: { fontSize: 16, color: Colors.text.primary },
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
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  tieDividerText: { fontSize: 10, color: Colors.text.muted, fontWeight: '700' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -CELL_GAP / 2 },
  gridCell: {
    width: `${100 / 5}%` as any,
    alignItems: 'center',
    padding: CELL_GAP / 2,
  },
  gridCoverWrap: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 2,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  gridCover: { width: '100%', height: '100%', backgroundColor: Colors.bg.tertiary },
  gridCornerLeft: { position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 3, borderTopRightRadius: 5 },
  gridCornerRight: { position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 3, borderTopLeftRadius: 5 },
  gridCornerText: { fontSize: 8.5, fontWeight: '800', color: '#fff' },
  gridAchievement: { fontSize: 8.5, color: Colors.text.secondary, marginTop: 2 },
  gridCoverSelected: { borderColor: Colors.accent.primary, borderWidth: 3 },
  gridCheckbox: {
    position: 'absolute', right: 3, top: 3,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  gridCheckboxChecked: { backgroundColor: Colors.accent.primary, borderColor: Colors.accent.primary },
  gridCheckboxMark: { fontSize: 10, fontWeight: '900', color: '#1a0a14' },
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
  selectionButtonPrimary: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.accent.primary,
  },
  selectionButtonPrimaryText: { fontSize: 11, fontWeight: '900', color: '#1a0a14' },
  bulkNoticeBar: {
    alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: 9, backgroundColor: `${Colors.functional.success}22`,
    borderWidth: 1, borderColor: `${Colors.functional.success}66`,
  },
  bulkNoticeText: { fontSize: 11, fontWeight: '700', color: Colors.functional.success },
});
