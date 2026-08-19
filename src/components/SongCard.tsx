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
}

export const SongCard = memo(function SongCard({
  music,
  onPress,
  onLongPress,
  highlightedDifficulties,
  selectedDifficultyIndex,
  showChinaVersion = true,
  allSongs = [],
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
        <Text style={styles.title} numberOfLines={1}>
          {music.title}
        </Text>
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
          {selected.map(index => (
            <DifficultyBadge
              key={index}
              index={index}
              level={music.level[index]}
              size="sm"
              highlighted={highlightedDifficulties?.includes(index) ?? selectedDifficultyIndex !== undefined}
            />
          ))}
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
  title: {
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
  },
  missingDifficulty: {
    fontSize: 10,
    color: Colors.functional.warning,
  },
});
