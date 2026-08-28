/**
 * B50 分享卡片（v1.13.0；v1.14.0 改为受控渲染元素）：总分 + 两池合计 + TOP15/TOP35
 * 曲绘网格。不再自带 ViewShot/注册逻辑，由 ShareCardOverlay 按需渲染并捕获。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { CoverImage } from './CoverImage';
import { computeB50 } from '../data/b50';
import type { MusicData, PlayerScore } from '../data/types';

interface Props {
  rawData: MusicData[];
  scores: PlayerScore[];
  serverRating: number | null;
  userName?: string;
}

export function B50ShareCard({ rawData, scores, serverRating, userName }: Props) {
  const b50 = useMemo(() => computeB50(rawData, scores), [rawData, scores]);
  const topNew = b50.entries.filter(entry => entry.pool === 'new').slice(0, 15);
  const topOld = b50.entries.filter(entry => entry.pool === 'old').slice(0, 35);

  const renderCell = (entry: (typeof topNew)[number]) => {
    const borderColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
    const music = rawData.find(candidate => candidate.id === entry.songId && candidate.type === entry.musicType);
    return (
      <View key={`${entry.songId}:${entry.musicType}:${entry.difficultyIndex}`} style={[styles.cell, { borderColor }]}>
        <CoverImage music={music ?? {
          id: entry.songId, title: entry.title, type: entry.musicType, ds: [], level: [], cids: [], charts: [],
          basic_info: { title: entry.title, artist: '', genre: '', is_new: entry.pool === 'new', bpm: 0, from: '', release_date: '' },
        }} allSongs={rawData} style={styles.cellCover} />
        <Text style={styles.cellRating}>{entry.rating}</Text>
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
          <Text style={styles.poolChipLabel}>新曲 15</Text>
          <Text style={styles.poolChipValue}>{b50.newSum}</Text>
        </View>
        <View style={styles.poolChip}>
          <Text style={styles.poolChipLabel}>旧曲 35</Text>
          <Text style={styles.poolChipValue}>{b50.oldSum}</Text>
        </View>
        {serverRating != null && (
          <View style={styles.poolChip}>
            <Text style={styles.poolChipLabel}>服务器 RA</Text>
            <Text style={styles.poolChipValue}>{serverRating}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>新曲 TOP15</Text>
      <View style={styles.grid}>{topNew.map(renderCell)}</View>

      <Text style={styles.sectionTitle}>旧曲 TOP35</Text>
      <View style={styles.grid}>{topOld.map(renderCell)}</View>

      <Text style={styles.footer}>maimate.flya.ccwu.cc · {new Date().toLocaleDateString()}</Text>
    </View>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: '#14142b',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName: { fontSize: 13, fontWeight: '900', color: '#ff6b9d' },
  userName: { fontSize: 11, color: '#9888b0', marginTop: 2 },
  totalWrap: { alignItems: 'flex-end' },
  totalValue: { fontSize: 34, fontWeight: '900', color: '#f0e6ff' },
  totalLabel: { fontSize: 9, color: '#9888b0' },
  poolsRow: { flexDirection: 'row', gap: 6 },
  poolChip: { flex: 1, backgroundColor: '#1e1e38', borderRadius: 8, paddingVertical: 5, alignItems: 'center' },
  poolChipLabel: { fontSize: 8.5, color: '#9888b0' },
  poolChipValue: { fontSize: 14, fontWeight: '900', color: '#f0e6ff' },
  sectionTitle: { fontSize: 9.5, fontWeight: '800', color: '#00d4ff', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: {
    width: CELL, height: CELL + 3,
    borderWidth: 1.5, borderRadius: 6, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  cellCover: { width: '100%', height: '100%' },
  cellRating: {
    position: 'absolute', right: 1, bottom: 0,
    fontSize: 7.5, fontWeight: '900', color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2,
    borderTopLeftRadius: 4,
  },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
