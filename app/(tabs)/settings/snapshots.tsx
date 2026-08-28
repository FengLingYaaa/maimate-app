/**
 * 快照管理（v1.13.0）：查看本地保存的最多 6 次成绩快照并支持删除。
 * v1.14.0：新增两份快照对比（记录数/服务器 RA/成绩逐谱面 diff）。
 */

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';
import { getChartKey } from '../../../src/data/bilibili-links';
import { useScoreStore } from '../../../src/store';
import type { ScoreSnapshot } from '../../../src/data/types';

export default function SnapshotsPage() {
  const snapshots = useScoreStore(state => state.snapshots);
  const deleteSnapshot = useScoreStore(state => state.deleteSnapshot);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 对比模式：先点一份快照「对比」作基准，再点另一份完成选择（旧时间在前）。
  const [compareBase, setCompareBase] = useState<ScoreSnapshot | null>(null);
  const [comparison, setComparison] = useState<{ base: ScoreSnapshot; target: ScoreSnapshot } | null>(null);

  const comparisonRows = useMemo(() => {
    if (!comparison) return [];
    return buildComparisonRows(comparison.base, comparison.target);
  }, [comparison]);

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
          每次成功同步成绩都会保存一份快照（最多保留最近 6 次）。点「对比」选两份快照查看成绩与 Rating 变化；删除快照不会影响本机成绩。
        </Text>
        {snapshots.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>还没有快照。去「设置 → Diving-Fish 成绩导入」同步一次成绩即可生成。</Text>
          </View>
        )}
        {comparison && (
          <ComparisonCard
            comparison={comparison}
            rows={comparisonRows}
            onClose={() => setComparison(null)}
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
    </View>
  );
}

/** 单谱面对比行。 */
interface ComparisonRow {
  chartKey: string;
  title: string;
  diffLabel: string;
  before: number | null;
  after: number | null;
  kind: 'added' | 'removed' | 'changed';
}

/** 纯函数：两份快照的逐谱面 diff（按曲名排序），供渲染与测试。 */
export function buildComparisonRows(base: ScoreSnapshot, target: ScoreSnapshot): ComparisonRow[] {
  const titleOf = (snapshot: ScoreSnapshot, chartKey: string): string => {
    const score = snapshot.scores.find(item => getChartKey(item.songId, item.type, item.difficultyIndex) === chartKey);
    return score ? `${score.songId}` : chartKey;
  };
  const baseMap = new Map(base.scores.map(score => [getChartKey(score.songId, score.type, score.difficultyIndex), score]));
  const targetMap = new Map(target.scores.map(score => [getChartKey(score.songId, score.type, score.difficultyIndex), score]));
  const keys = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const rows: ComparisonRow[] = [];
  for (const key of keys) {
    const before = baseMap.get(key) ?? null;
    const after = targetMap.get(key) ?? null;
    if (before && after) {
      if (before.achievement === after.achievement) continue;
      rows.push({ chartKey: key, title: titleOf(target, key), diffLabel: '变化', before: before.achievement, after: after.achievement, kind: 'changed' });
    } else if (after) {
      rows.push({ chartKey: key, title: titleOf(target, key), diffLabel: '新增', before: null, after: after.achievement, kind: 'added' });
    } else {
      rows.push({ chartKey: key, title: titleOf(base, key), diffLabel: '移除', before: before!.achievement, after: null, kind: 'removed' });
    }
  }
  const kindOrder = { added: 0, changed: 1, removed: 2 } as const;
  return rows.sort((left, right) => kindOrder[left.kind] - kindOrder[right.kind] || left.title.localeCompare(right.title));
}

/** 对比结果卡片：RA 变化 + 变化谱面列表。 */
function ComparisonCard({ comparison, rows, onClose }: {
  comparison: { base: ScoreSnapshot; target: ScoreSnapshot };
  rows: ComparisonRow[];
  onClose: () => void;
}) {
  const { base, target } = comparison;
  const raDelta = base.serverRating != null && target.serverRating != null
    ? target.serverRating - base.serverRating
    : null;
  return (
    <View style={styles.compareCard}>
      <View style={styles.compareHeader}>
        <Text style={styles.compareTitle}>快照对比</Text>
        <Pressable hitSlop={8} onPress={onClose}>
          <Text style={styles.compareClose}>收起</Text>
        </Pressable>
      </View>
      <Text style={styles.compareRange}>
        {new Date(base.syncedAt).toLocaleString()} → {new Date(target.syncedAt).toLocaleString()}
      </Text>
      <Text style={styles.compareSummary}>
        记录 {base.recordCount} → {target.recordCount} · RA {base.serverRating ?? '—'} → {target.serverRating ?? '—'}
        {raDelta !== null && (raDelta >= 0 ? `（+${raDelta}）` : `（${raDelta}）`)}
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.compareEmpty}>两份快照之间成绩没有变化</Text>
      ) : (
        rows.map(row => (
          <View key={row.chartKey} style={styles.compareRow}>
            <Text
              style={[
                styles.compareKind,
                row.kind === 'added' && { color: Colors.functional.success },
                row.kind === 'removed' && { color: Colors.functional.danger },
              ]}
            >
              {row.diffLabel}
            </Text>
            <Text style={styles.compareTitle2} numberOfLines={1}>{row.title}</Text>
            <Text style={styles.compareValue}>
              {row.before === null ? '—' : `${row.before.toFixed(4)}%`} → {row.after === null ? '—' : `${row.after.toFixed(4)}%`}
            </Text>
          </View>
        ))
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
  compareCard: { backgroundColor: Colors.bg.secondary, borderRadius: 12, padding: 12, gap: 7, borderWidth: 1, borderColor: Colors.border.accent },
  compareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareTitle: { fontSize: 14, fontWeight: '900', color: Colors.text.primary },
  compareClose: { fontSize: 11, fontWeight: '700', color: Colors.text.muted },
  compareRange: { fontSize: 11, color: Colors.text.secondary },
  compareSummary: { fontSize: 11, fontWeight: '700', color: Colors.accent.secondary },
  compareEmpty: { fontSize: 11, color: Colors.text.muted },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareKind: { width: 30, fontSize: 10, fontWeight: '800', color: Colors.accent.secondary },
  compareTitle2: { flex: 1, fontSize: 11, color: Colors.text.primary },
  compareValue: { fontSize: 10.5, color: Colors.text.secondary },
});