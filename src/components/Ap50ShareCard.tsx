/**
 * AP50 分享卡片（v1.16.9）：全 50 格表格布局（10 行 × 5），
 * 每格 = 难度色外框曲绘 + 左上排名 + 左下定数 + 右下 Rating。
 * 与拟合 50 卡的差异：无完成率颜色条与达成率文本（AP 曲目完成率一律 100.5%+），
 * 未满 50 时以空格占位。
 * 由 ShareCardOverlay 按需渲染并捕获。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { CoverImage } from './CoverImage';
import { computeAp50, AP50_SIZE } from '../data/ap50';
import type { MusicData, PlayerScore } from '../data/types';

interface Props {
  rawData: MusicData[];
  scores: PlayerScore[];
  userName?: string;
}

export function Ap50ShareCard({ rawData, scores, userName }: Props) {
  const ap50 = useMemo(() => computeAp50(rawData, scores), [rawData, scores]);
  const empties = Math.max(0, AP50_SIZE - ap50.entries.length);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · AP50</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalValue}>{ap50.total}</Text>
          <Text style={styles.totalLabel}>ap50</Text>
        </View>
      </View>

      <View style={styles.poolsRow}>
        <View style={styles.poolChip}>
          <Text style={styles.poolChipLabel}>AP</Text>
          <Text style={styles.poolChipValue}>{ap50.totalCount}</Text>
        </View>
        <View style={styles.poolChip}>
          <Text style={styles.poolChipLabel}>AP+</Text>
          <Text style={styles.poolChipValue}>{ap50.apPlusCount}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {ap50.entries.map(entry => {
          const borderColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
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
                <View style={styles.cellId}><Text style={styles.cellIdText}>{entry.songId}</Text></View>
                <Text style={styles.cellRank}>#{entry.rank}</Text>
                <View style={styles.cellCornerLeft}><Text style={styles.cellCornerText}>{entry.ds.toFixed(1)}</Text></View>
                <View style={styles.cellCornerRight}><Text style={styles.cellCornerText}>{entry.rating}</Text></View>
              </View>
            </View>
          );
        })}
        {Array.from({ length: empties }, (_, index) => (
          <View key={`ap-empty-${index}`} style={styles.cellWrap}>
            <View style={styles.emptyCell}><Text style={styles.emptyMark}>—</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>maimate.flya.ccwu.cc · {new Date().toLocaleDateString()}</Text>
    </View>
  );
}

// cellWrap = 20% 容器宽（320/5=64），CELL 60 + padding 2 = 64 精确。
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
  cellRank: {
    position: 'absolute', right: 0, top: 0,
    fontSize: 7.5, fontWeight: '900', color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2,
    borderBottomLeftRadius: 4,
  },
  cellCornerLeft: { position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopRightRadius: 4 },
  cellCornerRight: { position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 2, borderTopLeftRadius: 4 },
  cellCornerText: { fontSize: 7.5, fontWeight: '900', color: '#fff' },
  emptyCell: {
    width: CELL, height: CELL,
    borderWidth: 1.5, borderRadius: 6, borderStyle: 'dashed',
    borderColor: '#2a2a4a',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyMark: { fontSize: 10, color: '#3a3a5a', fontWeight: '800' },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
