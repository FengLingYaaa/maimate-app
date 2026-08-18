/**
 * 曲库首页 — 歌曲浏览器
 * 支持筛选、搜索、列表展示
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicStore } from '../src/store';
import { SongCard, FilterBar, TitleRecognizer } from '../src/components';
import { Colors } from '../src/constants';
import { getMatchingDifficultyIndices, MusicList } from '../src/data/music-list';
import type { FilterOptions, MusicData } from '../src/data/types';

function formatCacheTime(timestamp: number | null): string {
  if (!timestamp) return '尚未同步';
  return new Date(timestamp).toLocaleString();
}

export default function SongBrowser() {
  const router = useRouter();
  const [titleRecognizerVisible, setTitleRecognizerVisible] = useState(false);
  const rawData = useMusicStore(s => s.rawData);
  const musicList = useMusicStore(s => s.musicList);
  const loading = useMusicStore(s => s.loading);
  const updating = useMusicStore(s => s.updating);
  const cacheTimestamp = useMusicStore(s => s.cacheTimestamp);
  const error = useMusicStore(s => s.error);
  const filters = useMusicStore(s => s.filters);
  const applyFilters = useMusicStore(s => s.applyFilters);
  const clearFilters = useMusicStore(s => s.clearFilters);
  const loadData = useMusicStore(s => s.loadData);

  const songs = useMemo(() => musicList.all(), [musicList]);

  const genres = useMemo(() => [...new Set(rawData.map(m => m.basic_info.genre))].sort(), [rawData]);
  const versions = useMemo(() => [...new Set(rawData.map(m => m.basic_info.from))].sort(), [rawData]);
  const artists = useMemo(() => [...new Set(rawData.map(m => m.basic_info.artist))].sort(), [rawData]);
  const charters = useMemo(() => {
    const values = new Set<string>();
    rawData.forEach(music => music.charts.forEach(chart => {
      if (chart.charter && chart.charter !== '-') values.add(chart.charter);
    }));
    return [...values].sort();
  }, [rawData]);

  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  const openDownloadSite = useCallback(() => {
    void Linking.openURL('https://maimate.flya.ccwu.cc/');
  }, []);

  const openRecognizedSong = useCallback((music: MusicData) => {
    setTitleRecognizerVisible(false);
    router.push(`/song/${music.id}` as any);
  }, [router]);

  const getPreviewCount = useCallback((nextFilters: FilterOptions) => {
    return new MusicList(rawData).filter(nextFilters).length;
  }, [rawData]);

  const handleSongPress = useCallback((music: MusicData) => {
    router.push(`/song/${music.id}` as any);
  }, [router]);

  const handleSongLongPress = useCallback((music: MusicData) => {
    router.push(`/song/${music.id}` as any);
  }, [router]);

  const hasChartHighlightFilter = Boolean(
    filters.charter?.trim()
      || filters.difficulty !== undefined
      || filters.level !== undefined
      || filters.dsRange !== undefined,
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
            <Pressable style={styles.updateButton} onPress={openDownloadSite} accessibilityRole="button">
              <Text style={styles.updateButtonText}>更新 / 下载</Text>
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
        onApply={applyFilters}
        onClear={clearFilters}
        totalCount={rawData.length}
        filteredCount={songs.length}
        getPreviewCount={getPreviewCount}
        genres={genres}
        versions={versions}
        artists={artists}
        charters={charters}
      />

      {/* 歌曲列表 */}
      <FlatList
        data={songs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <SongCard
              music={item}
              onPress={handleSongPress}
              onLongPress={handleSongLongPress}
              highlightedDifficulties={hasChartHighlightFilter ? getMatchingDifficultyIndices(item, filters) : undefined}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading || updating}
            onRefresh={handleRefresh}
            tintColor={Colors.accent.primary}
            colors={[Colors.accent.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>没有匹配的歌曲</Text>
            <Pressable onPress={clearFilters}>
              <Text style={styles.clearLink}>清除筛选</Text>
            </Pressable>
          </View>
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
  updateButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: `${Colors.accent.primary}22`,
    borderWidth: 1,
    borderColor: Colors.accent.primary,
  },
  updateButtonText: {
    fontSize: 11,
    color: Colors.accent.primary,
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
});
