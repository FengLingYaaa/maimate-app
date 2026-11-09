/**
 * v1.19.0「本次同步战报」卡片：设置页「立即同步成绩」按钮下方，B50 页未读横幅点开也用它。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { DifficultyLabels } from '../constants/game';
import { formatAchievement } from '../data/rating';
import type { SyncReport, SyncReportEntryRef, SyncReportRow } from '../data/sync-report';

interface Props {
  report: SyncReport;
  onOpenB50?: () => void;
  onOpenHistory?: () => void;
  onOpenSong?: (ref: { songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number }) => void;
}

function signed(value: number, digits = 0): string {
  const text = digits > 0 ? value.toFixed(digits) : String(value);
  return value > 0 ? `+${text}` : text;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function diffLabel(index: number): string {
  return DifficultyLabels[index] ?? `难度 ${index}`;
}

export function SyncReportCard({ report, onOpenB50, onOpenHistory, onOpenSong }: Props) {
  const deltaColor = report.ratingDelta > 0 ? Colors.functional.success : report.ratingDelta < 0 ? Colors.functional.danger : Colors.text.secondary;
  const averageDelta = report.b50AverageAfter - report.b50AverageBefore;

  if (report.kind === 'baseline') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>本次同步战报 · {formatTime(report.syncedAt)}</Text>
        <Text style={styles.baseline}>已建立基线，下次同步开始显示涨分来源。</Text>
      </View>
    );
  }

  const renderRow = (row: SyncReportRow) => (
    <Pressable key={row.chartKey} style={styles.row} onPress={() => onOpenSong?.(row)} disabled={!onOpenSong}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
        <Text style={styles.rowSub}>
          <Text style={{ color: DifficultyColorMap[row.difficultyIndex] ?? Colors.text.secondary, fontWeight: '800' }}>{diffLabel(row.difficultyIndex)}</Text>
          {'  '}{row.before === null ? '新成绩' : formatAchievement(row.before)} → {formatAchievement(row.after)}
        </Text>
      </View>
      <Text style={[styles.rowDelta, { color: row.ratingDelta > 0 ? Colors.functional.success : Colors.functional.danger }]}>{signed(row.ratingDelta)}</Text>
    </Pressable>
  );

  const renderRef = (ref: SyncReportEntryRef) => (
    <Pressable key={`${ref.songId}:${ref.musicType}:${ref.difficultyIndex}`} style={styles.refRow} onPress={() => onOpenSong?.(ref)} disabled={!onOpenSong}>
      <Text style={styles.refTitle} numberOfLines={1}>{ref.title}</Text>
      <Text style={[styles.refMeta, { color: DifficultyColorMap[ref.difficultyIndex] ?? Colors.text.secondary }]}>{diffLabel(ref.difficultyIndex)}</Text>
      <Text style={styles.refMeta}>{ref.pool === 'new' ? 'B15' : 'B35'} · {ref.rating}</Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>本次同步战报 · {formatTime(report.syncedAt)}</Text>
      <Text style={styles.rating}>
        Rating {report.ratingBefore} → {report.ratingAfter}
        <Text style={{ color: deltaColor }}>（{signed(report.ratingDelta)}）</Text>
      </Text>
      <Text style={styles.small}>
        B50 平均 {report.b50AverageBefore.toFixed(2)} → {report.b50AverageAfter.toFixed(2)}（{signed(Math.round(averageDelta * 100) / 100, 2)}）
        {report.ratingSource === 'local' ? ' · 按本地 B50 计算' : ''}
      </Text>

      {report.topContributions.length === 0 && report.entered.length === 0 && report.left.length === 0 ? (
        <Text style={styles.empty}>本次没有影响 B50 的成绩变化。</Text>
      ) : (
        <>
          {report.topContributions.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>本次推分贡献 Top {report.topContributions.length}</Text>
              {report.topContributions.map(renderRow)}
            </View>
          )}
          {report.entered.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>B50 新入榜 · {report.entered.length}</Text>
              {report.entered.map(renderRef)}
            </View>
          )}
          {report.left.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>B50 出榜 · {report.left.length}</Text>
              {report.left.map(renderRef)}
            </View>
          )}
        </>
      )}

      {(onOpenB50 || onOpenHistory) && (
        <View style={styles.buttons}>
          {onOpenB50 && (
            <Pressable style={styles.button} onPress={onOpenB50}>
              <Text style={styles.buttonText}>查看 B50</Text>
            </Pressable>
          )}
          {onOpenHistory && (
            <Pressable style={styles.button} onPress={onOpenHistory}>
              <Text style={styles.buttonText}>查看 Rating 历史</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  title: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  baseline: { fontSize: 12, color: Colors.text.secondary },
  rating: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  small: { fontSize: 10, color: Colors.text.muted },
  empty: { fontSize: 12, color: Colors.text.secondary },
  block: { gap: 4, marginTop: 4 },
  blockTitle: { fontSize: 11, fontWeight: '800', color: Colors.accent.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowMain: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  rowSub: { fontSize: 10, color: Colors.text.secondary },
  rowDelta: { fontSize: 13, fontWeight: '800' },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  refTitle: { flex: 1, fontSize: 11, color: Colors.text.primary },
  refMeta: { fontSize: 10, color: Colors.text.secondary, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  button: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}14` },
  buttonText: { fontSize: 12, fontWeight: '800', color: Colors.accent.primary },
});
