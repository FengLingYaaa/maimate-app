/**
 * B50 分享卡片（v1.15.0 表格布局）：旧曲 35 在上（7×5）、新曲 15 在下（3×5），
 * 每格 = 难度色外框曲绘 + 左下定数 + 右下 Rating + 正下方完成率（带底纹）。
 * 由 ShareCardOverlay 按需渲染并捕获。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { CoverImage } from './CoverImage';
import { computeB50, achievementTier, ACHIEVEMENT_TIER_COLORS } from '../data/b50';
import { formatAchievement } from '../data/rating';
import type { MusicData, PlayerScore } from '../data/types';

interface Props {
  rawData: MusicData[];
  scores: PlayerScore[];
  serverRating: number | null;
  userName?: string;
}

export function B50ShareCard({ rawData, scores, serverRating, userName }: Props) {
  const b50 = useMemo(() => computeB50(rawData, scores), [rawData, scores]);
  const topOld = b50.entries.filter(entry => entry.pool === 'old');
  const topNew = b50.entries.filter(entry => entry.pool === 'new');

  const renderCell = (entry: (typeof topOld)[number]) => {
    const borderColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
    const tier = achievementTier(entry.achievement);
    const tierColor = ACHIEVEMENT_TIER_COLORS[tier];
    const music = rawData.find(candidate => candidate.id === entry.songId && candidate.type === entry.musicType);
    return (
      <View key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`} style={styles.cellWrap}>
        <View style={[styles.cell, { borderColor }]}>
          <CoverImage
            music={music ?? {
              id: entry.songId, title: entry.title, type: entry.musicType, ds: [], level: [], cids: [], charts: [],
              basic_info: { title: entry.title, artist: '', genre: '', is_new: entry.pool === 'new', bpm: 0, from: '', release_date: '' },
            }}
            allSongs={rawData}
            style={styles.cellCover}
          />
          <View style={styles.cellId}><Text style={styles.cellIdText}>{entry.songId}</Text></View>
          <View style={styles.cellCornerLeft}><Text style={styles.cellCornerText}>{entry.ds.toFixed(1)}</Text></View>
          <View style={styles.cellCornerRight}><Text style={styles.cellCornerText}>{entry.rating}</Text></View>
        </View>
        <View style={styles.cellUnderline}>
          <View style={[styles.cellUnderlineFill, { width: `${Math.min(100, entry.achievement)}%` as any, backgroundColor: tierColor }]} />
        </View>
        <Text style={[styles.cellAchievement, { color: tierColor }]} numberOfLines={1}>
          {formatAchievement(entry.achievement)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · 舞萌DX 查分</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalValue}>{b50.total}</Text>
          <Text style={styles.totalLabel}>B50</Text>
        </View>
      </View>

      <View style={styles.poolsRow}>
        <View style={styles.poolChip}>
          <Text style={styles.poolChipLabel}>旧曲 35</Text>
          <Text style={styles.poolChipValue}>{b50.oldSum}</Text>
        </View>
        <View style={styles.poolChip}>
          <Text style={styles.poolChipLabel}>新曲 15</Text>
          <Text style={styles.poolChipValue}>{b50.newSum}</Text>
        </View>
        {serverRating != null && (
          <View style={styles.poolChip}>
            <Text style={styles.poolChipLabel}>服务器 RA</Text>
            <Text style={styles.poolChipValue}>{serverRating}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>旧曲 TOP35</Text>
      <View style={styles.grid}>{topOld.map(renderCell)}</View>

      <Text style={styles.sectionTitle}>新曲 TOP15</Text>
      <View style={styles.grid}>{topNew.map(renderCell)}</View>

      <Text style={styles.footer}>maimate.flya.ccwu.cc · {new Date().toLocaleDateString()}</Text>
    </View>
  );
}

// cellWrap = 20% 容器宽（320/5=64），CELL 60 + 上下左右 padding 2 = 64 精确。
const CELL = 60;

const styles = StyleSheet.create({
  card: {
    width: 344,
    backgroundColor: '#14142b',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName: { fontSize: 13, fontWeight: '900', color: '#ff6b9d' },
  userName: { fontSize: 11, color: '#9888b0', marginTop: 2 },
  totalWrap: { alignItems: 'flex-end' },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#f0e6ff' },
  totalLabel: { fontSize: 9, color: '#9888b0' },
  poolsRow: { flexDirection: 'row', gap: 6 },
  poolChip: { flex: 1, backgroundColor: '#1e1e38', borderRadius: 8, paddingVertical: 5, alignItems: 'center' },
  poolChipLabel: { fontSize: 8.5, color: '#9888b0' },
  poolChipValue: { fontSize: 14, fontWeight: '900', color: '#f0e6ff' },
  sectionTitle: { fontSize: 9.5, fontWeight: '800', color: '#00d4ff', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '20%' as any, alignItems: 'center', padding: 2 },
  cell: {
    width: CELL, height: CELL,
    borderWidth: 1.5, borderRadius: 6, overflow: 'hidden',
    position: 'relative',
  },
  cellCover: { width: '100%', height: '100%' },
  cellId: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderBottomRightRadius: 4 },
  cellIdText: { fontSize: 7.5, fontWeight: '900', color: '#fff' },
  cellCornerLeft: { position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopRightRadius: 4 },
  cellCornerRight: { position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopLeftRadius: 4 },
  cellCornerText: { fontSize: 7.5, fontWeight: '900', color: '#fff' },
  cellUnderline: { width: CELL, height: 2.5, borderRadius: 2, backgroundColor: '#1e1e38', marginTop: 2, overflow: 'hidden' },
  cellUnderlineFill: { height: '100%' },
  cellAchievement: { fontSize: 7.5, fontWeight: '800', marginTop: 1 },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
