/**
 * Rating 榜共享展示组件（v1.15.0）：B50 与拟合 50 共用的列表行、网格格、分隔条。
 * 统一视图模型 UnifiedEntry 由页面从各自榜单条目映射而来。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import { CoverImage } from './CoverImage';
import { achievementTier, ACHIEVEMENT_TIER_COLORS } from '../data/b50';
import { formatAchievement } from '../data/rating';
import type { MusicData } from '../data/types';

/** B50 / 拟合 50 共用的展示视图模型。 */
export interface UnifiedEntry {
  key: string;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  /** 网格左下角文本（B50=定数一位小数，拟合50=拟合定数两位小数）。 */
  cornerLeft: string;
  rating: number;
  achievement: number;
  /** 排名（列表行展示）。 */
  rank: number;
  /** 列表 meta 行文本。 */
  metaText: string;
  /** 列表右侧难度徽章文本。 */
  chipText: string;
}

export function b50ToUnified(entry: {
  songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number; title: string;
  ds: number; rating: number; achievement: number; poolRank: number; pool: 'new' | 'old';
}): UnifiedEntry {
  return {
    key: `${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`,
    songId: entry.songId,
    musicType: entry.musicType,
    difficultyIndex: entry.difficultyIndex,
    title: entry.title,
    cornerLeft: entry.ds.toFixed(1),
    rating: entry.rating,
    achievement: entry.achievement,
    rank: entry.poolRank,
    metaText: `${entry.musicType} · 定数 ${entry.ds.toFixed(1)} · ${formatAchievement(entry.achievement)}`,
    chipText: DifficultyLabels[entry.difficultyIndex] || `难度 ${entry.difficultyIndex}`,
  };
}

export function fitToUnified(entry: {
  songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number; title: string;
  fitDiff: number; rating: number; achievement: number; rank: number;
}): UnifiedEntry {
  return {
    key: `${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`,
    songId: entry.songId,
    musicType: entry.musicType,
    difficultyIndex: entry.difficultyIndex,
    title: entry.title,
    cornerLeft: entry.fitDiff.toFixed(2),
    rating: entry.rating,
    achievement: entry.achievement,
    rank: entry.rank,
    metaText: `${entry.musicType} · 拟合定数 ${entry.fitDiff.toFixed(2)} · ${formatAchievement(entry.achievement)}`,
    chipText: `拟合 ${entry.fitDiff.toFixed(2)}`,
  };
}

export function fallbackMusicFor(entry: UnifiedEntry): MusicData {
  return {
    id: entry.songId,
    title: entry.title,
    type: entry.musicType,
    ds: [],
    level: [],
    cids: [],
    charts: [],
    basic_info: { title: entry.title, artist: '', genre: '', is_new: false, bpm: 0, from: '', release_date: '' },
  };
}

export function RatingEntryRow({ entry, music, allSongs, onPress }: {
  entry: UnifiedEntry;
  music?: MusicData;
  allSongs: MusicData[];
  onPress: () => void;
}) {
  const difficultyColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
  return (
    <Pressable style={styles.entryRow} onPress={onPress}>
      <Text style={styles.rank}>{entry.rank}</Text>
      <CoverImage music={music ?? fallbackMusicFor(entry)} allSongs={allSongs} style={styles.cover} />
      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
        <Text style={styles.entryMeta}>{entry.metaText}</Text>
      </View>
      <View style={styles.entryRight}>
        <Text style={[styles.diffChip, { color: difficultyColor, borderColor: `${difficultyColor}88`, backgroundColor: `${difficultyColor}1a` }]}>
          {entry.chipText}
        </Text>
        <Text style={styles.entryRating}>{entry.rating}</Text>
      </View>
    </Pressable>
  );
}

export function RatingGridCell({ entry, music, allSongs, selectionMode, selected, onPress, onLongPress }: {
  entry: UnifiedEntry;
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
        <CoverImage music={music ?? fallbackMusicFor(entry)} allSongs={allSongs} style={styles.gridCover} />
        <View style={styles.gridId}><Text style={styles.gridIdText}>{entry.songId}</Text></View>
        <View style={styles.gridCornerLeft}><Text style={styles.gridCornerText}>{entry.cornerLeft}</Text></View>
        <View style={styles.gridCornerRight}><Text style={styles.gridCornerText}>{entry.rating}</Text></View>
        {selectionMode && (
          <View style={[styles.gridCheckbox, selected && styles.gridCheckboxChecked]}>
            {selected && <Text style={styles.gridCheckboxMark}>✓</Text>}
          </View>
        )}
      </View>
      {/* v1.15.0：完成率底纹进度条（着色与文本一致）。 */}
      <View style={styles.gridUnderline}>
        <View
          style={[styles.gridUnderlineFill, { width: `${Math.min(100, entry.achievement)}%` as any, backgroundColor: achievementColor }]}
        />
      </View>
      <Text style={[styles.gridAchievement, { color: achievementColor }]} numberOfLines={1}>
        {formatAchievement(entry.achievement)}
      </Text>
    </Pressable>
  );
}

export function RatingTieDivider({ count, poolLastRank }: { count: number; poolLastRank: number }) {
  return (
    <View style={styles.tieDivider}>
      <Text style={styles.tieDividerText}>以下 {count} 首与第 {poolLastRank} 名同 Rating，暂未计入总分</Text>
    </View>
  );
}

const CELL_GAP = 6;
const CELL_SIZE = 60;

const styles = StyleSheet.create({
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  rank: { width: 24, fontSize: 14, fontWeight: '900', textAlign: 'center', color: Colors.accent.secondary },
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
  gridId: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 3, borderBottomRightRadius: 4 },
  gridIdText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  gridUnderline: {
    width: CELL_SIZE,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.bg.tertiary,
    marginTop: 2,
    overflow: 'hidden',
  },
  gridUnderlineFill: { height: '100%' },
  gridAchievement: { fontSize: 8.5, color: Colors.text.secondary, marginTop: 1 },
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
});
