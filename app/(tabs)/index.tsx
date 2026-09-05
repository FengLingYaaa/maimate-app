/**
 * 曲库首页 — 歌曲浏览器
 * 支持筛选、搜索、列表展示
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMusicStore, useScoreStore, useSettingsStore } from '../../src/store';
import { SongCard, FilterBar, TitleRecognizer } from '../../src/components';
import { Colors } from '../../src/constants';
import { getMatchingDifficultyIndices, getFitChartConstant, getMusicSearchScore, MusicList, buildScoreIndex, getMusicScore } from '../../src/data/music-list';
import { getChinaVersionOptions, getVersionOptions } from '../../src/data/version-catalog';
import { computeB50 } from '../../src/data/b50';
import type { FilterOptions, MusicData } from '../../src/data/types';

function formatCacheTime(timestamp: number | null): string {
  if (!timestamp) return '尚未同步';
  return new Date(timestamp).toLocaleString();
}

export default function SongBrowser() {
  const router = useRouter();
  const [titleRecognizerVisible, setTitleRecognizerVisible] = useState(false);
  const restoreTitleRecognizerOnFocus = useRef(false);
  // v1.17.0：曲库默认不加载全曲，首屏只保留搜索/筛选栏与「加载全曲」按钮，
  // 点击加载或进行任意搜索/筛选后才显示列表，省去首屏渲染上千曲目的开销。
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const rawData = useMusicStore(s => s.rawData);
  const musicList = useMusicStore(s => s.musicList);
  const updating = useMusicStore(s => s.updating);
  const cacheTimestamp = useMusicStore(s => s.cacheTimestamp);
  const error = useMusicStore(s => s.error);
  const filters = useMusicStore(s => s.filters);
  const chartStats = useMusicStore(s => s.chartStats);
  const applyFilters = useMusicStore(s => s.applyFilters);
  const applyFiltersChunked = useMusicStore(s => s.applyFiltersChunked);
  const clearFilters = useMusicStore(s => s.clearFilters);
  const settings = useSettingsStore(s => s.settings);
  const settingsLoaded = useSettingsStore(s => s.loaded);
  const scores = useScoreStore(s => s.scores);

  // v1.17.1：本地成绩索引（songId+type+难度 → 达成率），筛选排序与卡片成绩展示共用。
  const scoreIndex = useMemo(() => buildScoreIndex(scores), [scores]);

  // v1.12.0：曲库行 B50 徽标（songId → 池内最高排名，取该曲在榜内最好的一个谱面）。
  const b50BadgeBySong = useMemo(() => {
    if (scores.length === 0) return null;
    const b50 = computeB50(rawData, scores);
    const map = new Map<string, { rank: number; pool: 'new' | 'old' }>();
    for (const entry of b50.entries) {
      const existing = map.get(entry.songId);
      if (!existing || entry.poolRank < existing.rank) {
        map.set(entry.songId, { rank: entry.poolRank, pool: entry.pool });
      }
    }
    return map;
  }, [rawData, scores]);

  useEffect(() => {
    if (settingsLoaded && settings.defaultSort.mode !== 'relevance' && filters.sort === undefined) {
      applyFilters({ ...filters, sort: settings.defaultSort }, scoreIndex);
    }
  }, [settingsLoaded, settings.defaultSort, filters, applyFilters, scoreIndex]);

  // v1.17.1：成绩排序（scoreDesc）下，同步成绩使 scoreIndex 更新时必须立即重排，
  // 否则同步成绩后排序不刷新。此 effect 只依赖排序模式与 scoreIndex——
  // applyFilters 会写入新的 filters 对象，若把 filters 放进依赖会无限循环；
  // 这里改用 getState 读取最新筛选条件，依赖不变时不会重复执行。
  const sortMode = filters.sort?.mode;
  const isScoreSort = sortMode === 'scoreDesc';
  useEffect(() => {
    if (!isScoreSort) return;
    applyFilters(useMusicStore.getState().filters, scoreIndex);
  }, [isScoreSort, scoreIndex, applyFilters]);

  useFocusEffect(useCallback(() => {
    if (restoreTitleRecognizerOnFocus.current) {
      restoreTitleRecognizerOnFocus.current = false;
      setTitleRecognizerVisible(true);
    }
  }, []));

  // v1.17.0：未加载前不展示全曲列表（songs 仍可用于计数等）。
  const songs = useMemo(() => musicList.all(), [musicList]);
  const displaySongs = libraryLoaded ? songs : [];

  const loadAllSongs = useCallback(() => {
    // 用默认排序（ID 序）加载全曲：若已有筛选则按当前筛选加载。
    applyFilters(filters, scoreIndex);
    setLibraryLoaded(true);
  }, [applyFilters, filters, scoreIndex]);

  const handleApply = useCallback((next: FilterOptions) => {
    applyFilters(next, scoreIndex);
    setLibraryLoaded(true);
  }, [applyFilters, scoreIndex]);

  const genres = useMemo(() => [...new Set(rawData.map(m => m.basic_info.genre))].sort(), [rawData]);
  const versionOptions = useMemo(() => getVersionOptions(rawData), [rawData]);
  const chinaVersionOptions = useMemo(() => getChinaVersionOptions(rawData), [rawData]);
  const artists = useMemo(() => [...new Set(rawData.map(m => m.basic_info.artist))].sort(), [rawData]);
  const charters = useMemo(() => {
    const values = new Set<string>();
    rawData.forEach(music => music.charts.forEach(chart => {
      if (chart.charter && chart.charter !== '-') values.add(chart.charter);
    }));
    return [...values].sort();
  }, [rawData]);

  const openRecognizedSong = useCallback((music: MusicData) => {
    restoreTitleRecognizerOnFocus.current = true;
    setTitleRecognizerVisible(false);
    router.push({ pathname: '/song/[id]' as any, params: { id: music.id, type: music.type, source: 'library' } });
  }, [router]);

  const getPreviewCount = useCallback((nextFilters: FilterOptions) => {
    return new MusicList(rawData).filter(nextFilters).length;
  }, [rawData]);

  // v1.16.8：确认式搜索走 store 分片路径（评分+过滤一趟完成，进度条真实推进）。
  const runSearch = useCallback((nextFilters: FilterOptions, onProgress: (done: number, total: number) => void) => {
    return applyFiltersChunked(nextFilters, onProgress, scoreIndex);
  }, [applyFiltersChunked, scoreIndex]);

  const handleSongPress = useCallback((music: MusicData) => {
    router.push({ pathname: '/song/[id]' as any, params: { id: music.id, type: music.type, source: 'library' } });
  }, [router]);

  const handleSongLongPress = useCallback((music: MusicData) => {
    router.push({ pathname: '/song/[id]' as any, params: { id: music.id, type: music.type, source: 'library' } });
  }, [router]);

  const isFitSort = sortMode === 'fitAsc' || sortMode === 'fitDesc';
  // v1.17.1：成绩排序同样按单难度展示并高亮；未指定难度时默认 3（Master）。
  const sortDifficultyIndex = sortMode === 'constantAsc' || sortMode === 'constantDesc' || isFitSort || isScoreSort
    ? (filters.sort?.difficultyIndex ?? 3)
    : undefined;
  // v1.16.0：拟合定数排序时，行内徽章旁标注该难度拟合定数。
  const fitDiffForIndex = useCallback((music: MusicData) => (index: number) => {
    if (!isFitSort) return null;
    return getFitChartConstant(music, index, chartStats);
  }, [isFitSort, chartStats]);
  // v1.17.1：成绩排序时，行内徽章旁标注选中难度的本机达成率（无成绩显示 —）。
  const getScoreForDifficulty = useCallback((music: MusicData) => (index: number) => {
    if (!isScoreSort) return null;
    return getMusicScore(music, index, scoreIndex);
  }, [isScoreSort, scoreIndex]);
  const hasChartHighlightFilter = Boolean(
    filters.charter?.trim()
      || filters.difficulty !== undefined
      || filters.level !== undefined
      || filters.dsRange !== undefined
      || sortDifficultyIndex !== undefined,
  );

  return (
    <View style={styles.container}>
      {/* 顶部标题 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>🎵 曲库</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.scanButton} onPress={() => setTitleRecognizerVisible(true)} accessibilityRole="button">
              <Text style={styles.scanButtonText}>拍照识别</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.headerSub}>{rawData.length} 首歌曲 · 更新于 {formatCacheTime(cacheTimestamp)}</Text>
        {updating && <Text style={styles.updatingText}>正在后台同步 Diving-Fish 曲库…</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* 筛选栏 */}
      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={clearFilters}
        totalCount={rawData.length}
        filteredCount={songs.length}
        getPreviewCount={getPreviewCount}
        runSearch={runSearch}
        genres={genres}
        versionOptions={versionOptions}
        chinaVersionOptions={chinaVersionOptions}
        artists={artists}
        charters={charters}
        historyKey="library"
      />

      {/* 歌曲列表 */}
      <FlatList
        data={displaySongs}
        keyExtractor={item => `${item.id}-${item.type}`}
        renderItem={({ item }) => {
          const highlighted = new Set(hasChartHighlightFilter ? getMatchingDifficultyIndices(item, filters) : []);
          if (sortDifficultyIndex !== undefined) highlighted.add(sortDifficultyIndex);
          return (
            <View style={styles.cardWrapper}>
              <SongCard
                music={item}
                onPress={handleSongPress}
                onLongPress={handleSongLongPress}
                showChinaVersion={settings.showChinaVersion}
                allSongs={rawData}
                highlightedDifficulties={highlighted.size > 0 ? [...highlighted] : undefined}
                b50Badge={b50BadgeBySong?.get(item.id) ?? null}
                fitDiffForIndex={fitDiffForIndex(item)}
                scoreDifficultyIndex={isScoreSort ? sortDifficultyIndex : undefined}
                scoreForDifficulty={isScoreSort ? getScoreForDifficulty(item) : undefined}
              />
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !libraryLoaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>曲库尚未加载</Text>
              <Pressable style={styles.loadAllButton} onPress={loadAllSongs}>
                <Text style={styles.loadAllButtonText}>加载全曲</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>没有匹配的歌曲</Text>
              <Pressable onPress={clearFilters}>
                <Text style={styles.clearLink}>清除筛选</Text>
              </Pressable>
            </View>
          )
        }
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={10}
      />

      <TitleRecognizer
        visible={titleRecognizerVisible}
        rawData={rawData}
        onClose={() => setTitleRecognizerVisible(false)}
        onOpenSong={openRecognizedSong}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  scanButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: `${Colors.accent.secondary}22`,
    borderWidth: 1,
    borderColor: Colors.accent.secondary,
  },
  scanButtonText: {
    fontSize: 11,
    color: Colors.accent.secondary,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
  },
  updatingText: {
    fontSize: 11,
    color: Colors.accent.secondary,
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    color: Colors.functional.warning,
    marginTop: 4,
  },
  cardWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 80,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.muted,
  },
  clearLink: {
    fontSize: 14,
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  loadAllButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.accent.primary,
  },
  loadAllButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a0a14',
  },
});
