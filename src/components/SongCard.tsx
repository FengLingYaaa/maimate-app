/**
 * SongCard — 歌曲卡片组件
 * 在列表中展示单首歌曲的概览信息
 */

import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../constants';
import { DifficultyBadge } from './DifficultyBadge';
import type { MusicData } from '../data/types';

interface Props {
  music: MusicData;
  onPress?: (music: MusicData) => void;
  onLongPress?: (music: MusicData) => void;
  highlightedDifficulties?: number[];
}

export const SongCard = memo(function SongCard({ music, onPress, onLongPress, highlightedDifficulties }: Props) {
  const coverId = parseInt(music.id, 10);
  const len5 = coverId > 10000 && coverId <= 11000
    ? (coverId - 10000).toString().padStart(5, '0')
    : coverId.toString().padStart(5, '0');
  const coverUrl = `https://www.diving-fish.com/covers/${len5}.png`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(music)}
      onLongPress={() => onLongPress?.(music)}
    >
      <Image
        source={{ uri: coverUrl }}
        style={styles.cover}
        defaultSource={require('../../assets/icon.png')}
      />
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
        <View style={styles.difficulties}>
          {music.level.map((lv, i) => (
            <DifficultyBadge
              key={i}
              index={i}
              level={lv}
              size="sm"
              highlighted={highlightedDifficulties?.includes(i) ?? false}
            />
          ))}
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
  difficulties: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
});