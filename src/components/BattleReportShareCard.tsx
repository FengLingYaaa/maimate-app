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
import { onlyServerRaImprovements, sumServerRaIncreases } from '../data/server-ra';

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
  b50Delta?: number | null;
  serverRaDelta: number | null;
  achievementChanged: boolean;
}

interface Props {
  report: SnapshotBattleReport;
  base: { syncedAt: number; serverRating?: number | null };
  target: { syncedAt: number; serverRating?: number | null };
  rawData: MusicData[];
  userName?: string;
  onlyServerRaImprovements?: boolean;
}

export function BattleReportShareCard({ report, base, target, rawData, userName, onlyServerRaImprovements: onlyImprovements = false }: Props) {
  const changedRows = report.rows.filter(row => row.kind !== 'removed');
  const rows = onlyImprovements ? onlyServerRaImprovements(changedRows) : changedRows;
  const raDelta = base.serverRating != null && target.serverRating != null
    ? target.serverRating - base.serverRating
    : null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · 推分战报{onlyImprovements ? '（仅服务器 RA 提升）' : ''}</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
      </View>
      <Text style={styles.rangeLine}>
        {new Date(base.syncedAt).toLocaleDateString()} → {new Date(target.syncedAt).toLocaleDateString()}
      </Text>
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{onlyImprovements ? rows.filter(row => row.kind === 'added').length : report.addedCount}</Text>
          <Text style={styles.chipLabel}>新增</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{onlyImprovements ? rows.filter(row => row.kind === 'changed' && row.achievementChanged).length : report.changedCount}</Text>
          <Text style={styles.chipLabel}>达成率变化</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{rows.filter(row => row.kind === 'changed' && !row.achievementChanged).length}</Text>
          <Text style={styles.chipLabel}>RA 更新</Text>
        </View>
        {onlyImprovements ? (
          <View style={styles.chip}>
            <Text style={styles.chipValue}>+{sumServerRaIncreases(rows)}</Text>
            <Text style={styles.chipLabel}>单曲服务器 RA 合计</Text>
          </View>
        ) : raDelta !== null ? (
          <View style={styles.chip}>
            <Text style={styles.chipValue}>{raDelta >= 0 ? `+${raDelta}` : `${raDelta}`}</Text>
            <Text style={styles.chipLabel}>DX Rating</Text>
          </View>
        ) : null}
      </View>
      {rows.length === 0 && <Text style={styles.emptyText}>{onlyImprovements ? '两份快照中没有服务器 RA 提升的曲目' : '两份快照之间成绩没有变化'}</Text>}
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
                {row.kind === 'added' ? '新增 ' : row.achievementChanged ? '达成率变化 ' : '成绩记录 '}
                {row.before === null ? '—' : `${row.before.toFixed(4)}%`}
                {' → '}
                {row.after === null ? '—' : `${row.after.toFixed(4)}%`}
                {row.serverRaDelta !== null && row.serverRaDelta > 0 && (
                  <Text style={styles.raDelta}>  +{row.serverRaDelta} server RA</Text>
                )}
                {!onlyImprovements && row.b50Delta !== null && row.b50Delta > 0 && (
                  <Text style={styles.b50Delta}>  +{row.b50Delta} local B50</Text>
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
  raDelta: { fontWeight: '900', color: '#3dd68c' },
  b50Delta: { fontWeight: '800', color: '#ff6b9d' },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
