/**
 * 推分计划页
 * 展示用户标记的推分歌曲列表，支持排序、删除
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlanStore, useMusicStore } from '../src/store';
import { SongCard } from '../src/components';
import { Colors } from '../src/constants';
import type { PlanEntry, MusicData } from '../src/data/types';

export default function PushPlan() {
  const router = useRouter();
  const entries = usePlanStore(s => s.entries);
  const removeEntry = usePlanStore(s => s.removeEntry);
  const clearPlan = usePlanStore(s => s.clearPlan);
  const rawData = useMusicStore(s => s.rawData);

  // 将条目映射到完整歌曲数据
  const plannedSongs = useMemo(() => {
    return entries
      .map(entry => {
        const music = rawData.find(m => m.id === entry.songId);
        return music ? { music, entry } : null;
      })
      .filter((x): x is { music: MusicData; entry: PlanEntry } => x !== null);
  }, [entries, rawData]);

  const handleRemove = useCallback((songId: string, diffIdx: number) => {
    Alert.alert('移出计划', '确定要从推分计划中移除此歌曲吗？', [
      { text: '取消', style: 'cancel' },
      { text: '移除', style: 'destructive', onPress: () => removeEntry(songId, diffIdx) },
    ]);
  }, [removeEntry]);

  const handleClear = useCallback(() => {
    Alert.alert('清空计划', '确定要清空整个推分计划吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: clearPlan },
    ]);
  }, [clearPlan]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📋 推分计划</Text>
          {entries.length > 0 && (
            <Pressable onPress={handleClear}>
              <Text style={styles.clearBtn}>清空</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.headerSub}>
          {entries.length > 0 ? `${entries.length} 首待练习` : '还没有添加歌曲'}
        </Text>
      </View>

      {plannedSongs.length > 0 ? (
        <FlatList
          data={plannedSongs}
          keyExtractor={item => `${item.music.id}-${item.entry.difficultyIndex}`}
          renderItem={({ item, index }) => (
            <View style={styles.cardWrapper}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>
              <View style={styles.cardWithAction}>
                <View style={styles.cardFlex}>
                  <SongCard
                    music={item.music}
                    onPress={() => router.push(`/song/${item.music.id}` as any)}
                  />
                </View>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.music.id, item.entry.difficultyIndex)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
              {item.entry.note && (
                <Text style={styles.noteText}>💬 {item.entry.note}</Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyText}>暂未添加推分歌曲</Text>
              <Text style={styles.emptySub}>在曲库中长按歌曲即可添加到推分计划</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>暂未添加推分歌曲</Text>
          <Text style={styles.emptySub}>在曲库中长按歌曲即可添加到推分计划</Text>
        </View>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  clearBtn: {
    fontSize: 14,
    color: Colors.functional.danger,
    fontWeight: '600',
  },
  cardWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  orderBadge: {
    position: 'absolute',
    top: 12,
    left: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  cardWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFlex: {
    flex: 1,
  },
  removeBtn: {
    padding: 8,
  },
  removeBtnText: {
    fontSize: 16,
    color: Colors.functional.danger,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
    paddingLeft: 40,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 80,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.text.muted,
  },
});