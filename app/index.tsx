/**
 * 曲库首页 — 歌曲浏览器
 * 支持筛选、搜索、列表展示
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicStore } from '../src/store';
import { SongCard, FilterBar } from '../src/components';
import { Colors } from '../src/constants';
import { MusicList } from '../src/data/music-list';
import type { FilterOptions, MusicData } from '../src/data/types';

export default function SongBrowser() {
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const musicList = useMusicStore(s => s.musicList);
  const loading = useMusicStore(s => s.loading);
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

  const getPreviewCount = useCallback((nextFilters: FilterOptions) => {
    return new MusicList(rawData).filter(nextFilters).length;
  }, [rawData]);

  const handleSongPress = useCallback((music: MusicData) => {
    router.push(`/song/${music.id}` as any);
  }, [router]);

  const handleSongLongPress = useCallback((music: MusicData) => {
    router.push(`/song/${music.id}` as any);
  }, [router]);

  return (
    <View style={styles.container}>
      {/* 顶部标题 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎵 曲库</Text>
        <Text style={styles.headerSub}>{rawData.length} 首歌曲</Text>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
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
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
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