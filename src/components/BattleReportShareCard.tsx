/**
 * 快照推分战报分享卡（v1.15.2）：导出用深色卡片，逐曲（曲绘/曲名/难度/±RA）+ 汇总 chips。
 * 由快照管理页 ShareCardOverlay 按需渲染捕获；布局独立于页面内战报卡。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import { CoverImage } from './CoverImage';
import type { MusicData } from '../data/types';
import type { SnapshotBattleReport } from '../data/snapshot-battle';

interface Row {
  chartKey: string;
  songId: string;
  title: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  before: number | null;
  after: number | null;
  ratingDelta: number | null;
  kind: 'added' | 'removed' | 'changed';
}

interface Props {
  report: SnapshotBattleReport;
  base: { syncedAt: number };
  target: { syncedAt: number };
  rawData: MusicData[];
  userName?: string;
}

export function BattleReportShareCard({ report, base, target, rawData, userName }: Props) {
  const rows = report.rows.filter(row => row.kind !== 'removed');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · 推分战报</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
      </View>
      <Text style={styles.rangeLine}>
        {new Date(base.syncedAt).toLocaleDateString()} → {new Date(target.syncedAt).toLocaleDateString()}
      </Text>
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{report.addedCount}</Text>
          <Text style={styles.chipLabel}>新增</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{report.changedCount}</Text>
          <Text style={styles.chipLabel}>上分</Text>
        </View>
      </View>
      {rows.length === 0 && <Text style={styles.emptyText}>两份快照之间成绩没有变化</Text>}
      {rows.map(row => {
        const music = rawData.find(candidate => candidate.id === row.songId && candidate.type === row.musicType);
        const diffColor = DifficultyColorMap[row.difficultyIndex] || Colors.accent.secondary;
        return (
          <View key={row.chartKey} style={styles.battleRow}>
            <CoverImage
              music={music ?? {
                id: row.songId, title: row.title, type: row.musicType, ds: [], level: [], cids: [], charts: [],
                basic_info: { title: row.title, artist: '', genre: '', is_new: false, bpm: 0, from: '', release_date: '' },
              }}
              allSongs={rawData}
              style={styles.battleCover}
            />
            <View style={styles.battleInfo}>
              <View style={styles.battleTitleRow}>
                <Text style={styles.battleTitle} numberOfLines={1}>{row.title}</Text>
                <Text style={[styles.battleDiff, { color: diffColor }]}>
                  {DifficultyLabels[row.difficultyIndex] || `难度${row.difficultyIndex}`}
                </Text>
              </View>
              <Text style={styles.battleValue}>
                {row.kind === 'added' ? '新增 ' : ''}{row.before === null ? '—' : `${row.before.toFixed(4)}%`}
                {' → '}
                {row.after === null ? '—' : `${row.after.toFixed(4)}%`}
                {row.ratingDelta !== null && (
                  <Text style={styles.raDelta}>
                    {row.ratingDelta >= 0 ? `  +${row.ratingDelta}` : `  ${row.ratingDelta}`} RA
                  </Text>
                )}
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.footer}>maimate.flya.ccwu.cc</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 344,
    backgroundColor: '#14142b',
    borderRadius: 16,
    padding: 12,
    gap: 7,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName: { fontSize: 13, fontWeight: '900', color: '#ff6b9d' },
  userName: { fontSize: 11, color: '#9888b0', marginTop: 2 },
  rangeLine: { fontSize: 10, color: '#00d4ff', fontWeight: '700' },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: '#1e1e38', borderRadius: 8, paddingVertical: 5, alignItems: 'center' },
  chipValue: { fontSize: 14, fontWeight: '900', color: '#f0e6ff' },
  chipLabel: { fontSize: 8.5, color: '#9888b0' },
  emptyText: { fontSize: 10.5, color: '#9888b0' },
  battleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e1e38', borderRadius: 9, padding: 7 },
  battleCover: { width: 34, height: 34, borderRadius: 6, backgroundColor: '#14142b' },
  battleInfo: { flex: 1, gap: 2 },
  battleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  battleTitle: { flex: 1, fontSize: 11.5, fontWeight: '700', color: '#f0e6ff' },
  battleDiff: { fontSize: 9.5, fontWeight: '800' },
  battleValue: { fontSize: 10, color: '#c8bce0' },
  raDelta: { fontWeight: '900', color: '#ffd166' },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
