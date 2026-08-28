/**
 * 拟合 50 分享卡片（v1.15.0）：全 50 格表格布局（10 行 × 5），
 * 每格 = 难度色外框曲绘 + 左上排名 + 左下拟合定数 + 右下 Rating + 正下方完成率。
 * 由 ShareCardOverlay 按需渲染并捕获。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { CoverImage } from './CoverImage';
import { computeFit50 } from '../data/fit50';
import { fitAchievementTier } from '../data/fit50';
import { formatAchievement } from '../data/rating';
import type { ChartStatsMap, MusicData, PlayerScore } from '../data/types';

interface Props {
  rawData: MusicData[];
  scores: PlayerScore[];
  chartStats: ChartStatsMap;
  serverRating: number | null;
  userName?: string;
}

const TIER_COLORS: Record<string, string> = {
  gold: '#ffd166',
  green: '#3dd68c',
  default: '#9888b0',
};

export function Fit50ShareCard({ rawData, scores, chartStats, serverRating, userName }: Props) {
  const fit50 = useMemo(() => computeFit50(rawData, scores, chartStats), [rawData, scores, chartStats]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · 拟合 50</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalValue}>{fit50.total}</Text>
          <Text style={styles.totalLabel}>FIT50</Text>
        </View>
      </View>

      {serverRating != null && (
        <Text style={styles.serverLine}>服务器 RA {serverRating} · 按拟合定数计算</Text>
      )}

      <View style={styles.grid}>
        {fit50.entries.map(entry => {
          const borderColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
          const tier = fitAchievementTier(entry.achievement);
          const music = rawData.find(candidate => candidate.id === entry.songId && candidate.type === entry.musicType);
          return (
            <View key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`} style={styles.cellWrap}>
              <View style={[styles.cell, { borderColor }]}>
                <CoverImage
                  music={music ?? {
                    id: entry.songId, title: entry.title, type: entry.musicType, ds: [], level: [], cids: [], charts: [],
                    basic_info: { title: entry.title, artist: '', genre: '', is_new: false, bpm: 0, from: '', release_date: '' },
                  }}
                  allSongs={rawData}
                  style={styles.cellCover}
                />
                <Text style={styles.cellRank}>#{entry.rank}</Text>
                <View style={styles.cellCornerLeft}><Text style={styles.cellCornerText}>{entry.fitDiff.toFixed(2)}</Text></View>
                <View style={styles.cellCornerRight}><Text style={styles.cellCornerText}>{entry.rating}</Text></View>
              </View>
              <View style={styles.cellUnderline}>
                <View style={[styles.cellUnderlineFill, { width: `${Math.min(100, entry.achievement)}%` as any, backgroundColor: TIER_COLORS[tier] }]} />
              </View>
              <Text style={[styles.cellAchievement, { color: TIER_COLORS[tier] }]} numberOfLines={1}>
                {formatAchievement(entry.achievement)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>maimate.flya.ccwu.cc · {new Date().toLocaleDateString()}</Text>
    </View>
  );
}

const CELL = 56;

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
  serverLine: { fontSize: 9, color: '#00d4ff', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  cellWrap: { width: CELL + 6, alignItems: 'center' },
  cell: {
    width: CELL, height: CELL,
    borderWidth: 1.5, borderRadius: 6, overflow: 'hidden',
    position: 'relative',
  },
  cellCover: { width: '100%', height: '100%' },
  cellRank: {
    position: 'absolute', left: 1, top: 0,
    fontSize: 7.5, fontWeight: '900', color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2,
    borderBottomRightRadius: 4,
  },
  cellCornerLeft: { position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopRightRadius: 4 },
  cellCornerRight: { position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopLeftRadius: 4 },
  cellCornerText: { fontSize: 7.5, fontWeight: '900', color: '#fff' },
  cellUnderline: { width: CELL, height: 2.5, borderRadius: 2, backgroundColor: '#1e1e38', marginTop: 2, overflow: 'hidden' },
  cellUnderlineFill: { height: '100%' },
  cellAchievement: { fontSize: 7.5, fontWeight: '800', marginTop: 1 },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
