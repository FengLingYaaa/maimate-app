/**
 * SongCard — 歌曲卡片组件
 * 在列表中展示单首歌曲的概览信息。
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../constants';
import { DifficultyBadge } from './DifficultyBadge';
import { CoverImage } from './CoverImage';
import { getChinaVersionName } from '../constants/game';
import type { MusicData } from '../data/types';

interface Props {
  music: MusicData;
  onPress?: (music: MusicData) => void;
  onLongPress?: (music: MusicData) => void;
  highlightedDifficulties?: number[];
  /** 计划页使用：只展示这个条目的选中难度。 */
  selectedDifficultyIndex?: number;
  showChinaVersion?: boolean;
  allSongs?: MusicData[];
  /** v1.12.0：曲库行 B50 徽标（该曲任一谱面在 B50 榜内时显示「B50 #池内排名」）。 */
  b50Badge?: { rank: number; pool: 'new' | 'old' } | null;
  /** v1.16.0：拟合定数排序启用时，按难度返回拟合定数（无数据 null），徽章旁标注。 */
  fitDiffForIndex?: (index: number) => number | null;
}

export const SongCard = memo(function SongCard({
  music,
  onPress,
  onLongPress,
  highlightedDifficulties,
  selectedDifficultyIndex,
  showChinaVersion = true,
  allSongs = [],
  b50Badge = null,
  fitDiffForIndex,
}: Props) {
  const selected = selectedDifficultyIndex !== undefined
    ? music.level[selectedDifficultyIndex] !== undefined
      ? [selectedDifficultyIndex]
      : []
    : music.level.map((_, index) => index);
  const chinaVersion = getChinaVersionName(music.basic_info.from);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(music)}
      onLongPress={() => onLongPress?.(music)}
    >
      <CoverImage music={music} allSongs={allSongs} style={styles.cover} accessibilityLabel={`${music.title} 曲绘`} />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {music.title}
          </Text>
          {b50Badge && (
            <View style={[styles.b50Badge, b50Badge.pool === 'new' ? styles.b50BadgeNew : styles.b50BadgeOld]}>
              <Text style={styles.b50BadgeText}>{b50Badge.pool === 'new' ? 'B15' : 'B35'} #{b50Badge.rank}</Text>
            </View>
          )}
        </View>
        <Text style={styles.artist} numberOfLines={1}>
          {music.basic_info.artist}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{music.basic_info.genre}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>BPM {music.basic_info.bpm}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={[styles.metaText, styles.typeTag, music.type === 'DX' && styles.typeDx]}>
            {music.type}
          </Text>
        </View>
        <Text style={styles.version} numberOfLines={1}>原始：{music.basic_info.from}</Text>
        {showChinaVersion && chinaVersion !== music.basic_info.from && (
          <Text style={styles.version} numberOfLines={1}>国区：{chinaVersion}</Text>
        )}
        <View style={styles.difficulties}>
          {selected.map(index => {
            const fitDiff = fitDiffForIndex?.(index) ?? null;
            return (
              <View key={index} style={styles.diffCell}>
                <DifficultyBadge
                  index={index}
                  level={music.level[index]}
                  size="sm"
                  highlighted={highlightedDifficulties?.includes(index) ?? selectedDifficultyIndex !== undefined}
                />
                {fitDiff !== null && <Text style={styles.fitDiffText}>{fitDiff.toFixed(2)}</Text>}
              </View>
            );
          })}
          {selected.length === 0 && <Text style={styles.missingDifficulty}>该难度已不在当前曲库</Text>}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  cardPressed: {
    backgroundColor: Colors.bg.tertiary,
    borderColor: Colors.border.accent,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  b50Badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  b50BadgeNew: { backgroundColor: `${Colors.accent.secondary}22`, borderWidth: 1, borderColor: `${Colors.accent.secondary}66` },
  b50BadgeOld: { backgroundColor: `${Colors.text.secondary}22`, borderWidth: 1, borderColor: `${Colors.text.secondary}66` },
  b50BadgeText: { fontSize: 9, fontWeight: '800', color: Colors.text.primary },
  title: {
    // v1.14.0：占满剩余宽度并允许收缩，长曲名截断省略，B15/B35 徽标不再被顶出屏幕。
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  artist: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  metaDot: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  typeTag: {
    fontWeight: '600',
  },
  typeDx: {
    color: Colors.accent.secondary,
  },
  version: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  difficulties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  diffCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fitDiffText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.accent.secondary,
  },
  missingDifficulty: {
    fontSize: 10,
    color: Colors.functional.warning,
  },
});
