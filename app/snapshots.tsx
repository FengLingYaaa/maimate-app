/**
 * 快照管理（v1.13.0）：查看本地保存的成绩快照并支持删除。
 * v1.14.0：两份快照对比。v1.15.0：推分战报——逐曲卡片（曲绘/曲名/难度徽章/
 * 旧→新达成率/±Rating）+ 汇总条（新增/上分/移除计数与总 Rating 变化）；
 * 保留数量由设置驱动（默认 20，可设至多 1000）。
 */

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../src/constants';
import { CoverImage } from '../src/components/CoverImage';
import { ShareCardOverlay } from '../src/components/ShareCardOverlay';
import { BattleReportShareCard } from '../src/components/BattleReportShareCard';
import { buildSnapshotBattleReport } from '../src/data/snapshot-battle';
import { shareCardFileName } from '../src/data/share-card';
import { useMusicStore, useScoreStore, useSettingsStore } from '../src/store';
import type { MusicData, ScoreSnapshot } from '../src/data/types';

export default function SnapshotsPage() {
  const snapshots = useScoreStore(state => state.snapshots);
  const deleteSnapshot = useScoreStore(state => state.deleteSnapshot);
  const rawData = useMusicStore(state => state.rawData);
  const profile = useScoreStore(state => state.profile);
  const snapshotLimit = useSettingsStore(state => state.settings.snapshotLimit);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 对比模式：先点一份快照「对比」作基准，再点另一份完成选择（旧时间在前）。
  const [compareBase, setCompareBase] = useState<ScoreSnapshot | null>(null);
  const [comparison, setComparison] = useState<{ base: ScoreSnapshot; target: ScoreSnapshot } | null>(null);
  // v1.15.2：战报分享卡预览开关。
  const [shareVisible, setShareVisible] = useState(false);

  const report = useMemo(() => {
    if (!comparison) return null;
    return buildSnapshotBattleReport(comparison.base, comparison.target, rawData);
  }, [comparison, rawData]);

  const confirmDelete = (snapshotId: string, syncedAt: number) => {
    Alert.alert(
      '删除快照',
      `删除 ${new Date(syncedAt).toLocaleString()} 的快照？只影响本机对照记录，不影响成绩与服务器。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setDeletingId(snapshotId);
            void deleteSnapshot(snapshotId).finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };

  const startCompare = (snapshot: ScoreSnapshot) => {
    if (!compareBase) {
      setCompareBase(snapshot);
      return;
    }
    if (compareBase.id === snapshot.id) {
      setCompareBase(null);
      return;
    }
    const [base, target] = compareBase.syncedAt <= snapshot.syncedAt
      ? [compareBase, snapshot]
      : [snapshot, compareBase];
    setComparison({ base, target });
    setCompareBase(null);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '快照管理', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          每次成功同步成绩都会保存一份快照（当前保留最近 {snapshotLimit} 份，可在设置中调整）。点「对比」选两份快照查看推分战报；删除快照不会影响本机成绩。
        </Text>
        {snapshots.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>还没有快照。去「设置 → Diving-Fish 成绩导入」同步一次成绩即可生成。</Text>
          </View>
        )}
        {report && comparison && (
          <BattleReportCard
            base={comparison.base}
            target={comparison.target}
            report={report}
            rawData={rawData}
            onClose={() => setComparison(null)}
            onShare={() => setShareVisible(true)}
          />
        )}
        {compareBase && (
          <View style={styles.pickTargetBar}>
            <Text style={styles.pickTargetText}>已选基准快照，再点另一份快照的「对比」完成选择</Text>
          </View>
        )}
        {[...snapshots].reverse().map(snapshot => (
          <View key={snapshot.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.syncedAt}>{new Date(snapshot.syncedAt).toLocaleString()}</Text>
              <View style={styles.cardActions}>
                <Pressable hitSlop={8} onPress={() => startCompare(snapshot)}>
                  <Text style={styles.compareText}>对比</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  disabled={deletingId === snapshot.id}
                  onPress={() => confirmDelete(snapshot.id, snapshot.syncedAt)}
                >
                  <Text style={styles.deleteText}>{deletingId === snapshot.id ? '删除中…' : '删除'}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>记录 {snapshot.recordCount} 条</Text>
              <Text style={styles.meta}>服务器 RA {snapshot.serverRating ?? '—'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {shareVisible && comparison && report && (
        <ShareCardOverlay
          visible
          fileName={shareCardFileName('MaiMate-battle')}
          onClose={() => setShareVisible(false)}
          card={(
            <BattleReportShareCard
              report={report}
              base={comparison.base}
              target={comparison.target}
              rawData={rawData}
              userName={profile?.nickname ?? profile?.username}
            />
          )}
        />
      )}
    </View>
  );
}

/** 推分战报卡片：汇总条 + 逐曲战报行（曲绘/曲名/难度/达成率变化/±Rating）。 */
function BattleReportCard({ base, target, report, rawData, onClose, onShare }: {
  base: ScoreSnapshot;
  target: ScoreSnapshot;
  report: ReturnType<typeof buildSnapshotBattleReport>;
  rawData: MusicData[];
  onClose: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const raDelta = base.serverRating != null && target.serverRating != null
    ? target.serverRating - base.serverRating
    : null;
  return (
    <View style={styles.compareCard}>
      <View style={styles.compareHeader}>
        <Text style={styles.compareTitle}>推分战报</Text>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Pressable hitSlop={8} onPress={onShare}>
            <Text style={styles.compareShareText}>分享战报</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={onClose}>
            <Text style={styles.compareClose}>收起</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.compareRange}>
        {new Date(base.syncedAt).toLocaleString()} → {new Date(target.syncedAt).toLocaleString()}
      </Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipValue}>{report.addedCount}</Text>
          <Text style={styles.summaryChipLabel}>新增</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipValue}>{report.changedCount}</Text>
          <Text style={styles.summaryChipLabel}>上分</Text>
        </View>
        {raDelta !== null && (
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue}>{raDelta >= 0 ? `+${raDelta}` : `${raDelta}`}</Text>
            <Text style={styles.summaryChipLabel}>DX Rating</Text>
          </View>
        )}
      </View>
      <Text style={styles.compareSummary}>
        记录 {base.recordCount} → {target.recordCount}
      </Text>
      {report.rows.filter(row => row.kind !== 'removed').length === 0 ? (
        <Text style={styles.compareEmpty}>两份快照之间成绩没有变化</Text>
      ) : (
        report.rows.filter(row => row.kind !== 'removed').map(row => {
          const music = rawData.find(candidate => candidate.id === row.songId && candidate.type === row.musicType);
          const difficultyColor = DifficultyColorMap[row.difficultyIndex] || Colors.accent.secondary;
          // v1.16.7：行可点击进详情页；详情页返回时 replace 回快照页（source: 'snapshots'）。
          return (
            <Pressable
              key={row.chartKey}
              style={styles.battleRow}
              disabled={!music}
              onPress={() => music && router.push({
                pathname: '/song/[id]' as any,
                params: { id: music.id, type: music.type, difficultyIndex: String(row.difficultyIndex), source: 'snapshots' },
              })}
            >
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
                  <Text style={[styles.battleDiff, { color: difficultyColor }]}>
                    {DifficultyLabels[row.difficultyIndex] || `难度${row.difficultyIndex}`}
                  </Text>
                </View>
                <Text style={styles.battleValue}>
                  {row.kind === 'added' && <Text style={{ color: Colors.functional.success }}>新增 </Text>}
                  {row.kind === 'removed' && <Text style={{ color: Colors.functional.danger }}>移除 </Text>}
                  {row.before === null ? '—' : `${row.before.toFixed(4)}%`}
                  {' → '}
                  {row.after === null ? '—' : `${row.after.toFixed(4)}%`}
                  {row.b50Delta !== null && row.b50Delta > 0 && (
                    <Text style={styles.ratingDeltaText}>
                      {row.b50Delta >= 0 ? `  +${row.b50Delta}` : `  ${row.b50Delta}`} RA
                    </Text>
                  )}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 14, gap: 10 },
  note: { fontSize: 11, lineHeight: 17, color: Colors.text.muted },
  emptyCard: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 16 },
  emptyText: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  pickTargetBar: { alignItems: 'center', paddingVertical: 8, borderRadius: 9, backgroundColor: `${Colors.accent.secondary}18`, borderWidth: 1, borderColor: `${Colors.accent.secondary}55` },
  pickTargetText: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  card: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 12, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardActions: { flexDirection: 'row', gap: 14 },
  syncedAt: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  compareText: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  deleteText: { fontSize: 11, fontWeight: '700', color: Colors.functional.danger },
  metaRow: { flexDirection: 'row', gap: 14 },
  meta: { fontSize: 11, color: Colors.text.muted },
  compareCard: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: Colors.border.accent },
  compareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareTitle: { fontSize: 14, fontWeight: '900', color: Colors.text.primary },
  compareClose: { fontSize: 11, fontWeight: '700', color: Colors.text.muted },
  compareShareText: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  compareRange: { fontSize: 11, color: Colors.text.secondary },
  summaryRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  summaryChip: {
    backgroundColor: Colors.bg.tertiary, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 9,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light,
  },
  summaryChipValue: { fontSize: 13, fontWeight: '900', color: Colors.text.primary },
  summaryChipLabel: { fontSize: 8.5, color: Colors.text.muted, marginTop: 1 },
  compareSummary: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  compareEmpty: { fontSize: 11, color: Colors.text.muted },
  battleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: Colors.bg.tertiary, borderRadius: 10, padding: 8,
  },
  battleCover: { width: 38, height: 38, borderRadius: 7, backgroundColor: Colors.bg.secondary },
  battleInfo: { flex: 1, gap: 3 },
  battleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  battleTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  battleDiff: { fontSize: 9.5, fontWeight: '800' },
  battleValue: { fontSize: 10.5, color: Colors.text.secondary },
  ratingDeltaText: { fontWeight: '900', color: Colors.accent.primary },
});
