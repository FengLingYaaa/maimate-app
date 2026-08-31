import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap, DifficultyLabels, getChinaVersionName } from '../constants';
import { calculateRating, formatAchievement } from '../data/rating';
import { formatClearStatus } from '../data/status-labels';
import { getOfficialChartConstant } from '../data/music-list';
import { computeB50Gain } from '../data/b50';
import { CoverImage } from './CoverImage';
import type { MusicData, PlanEntry, PlayerScore } from '../data/types';

interface Props {
  music: MusicData;
  entry: PlanEntry;
  index: number;
  allSongs: MusicData[];
  allScores: PlayerScore[];
  importedScore?: PlayerScore;
  showChinaVersion: boolean;
  showProjectedRating: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
  onTarget: (score: number | null) => void;
}

export const PlanEntryCard = memo(function PlanEntryCard({ music, entry, index, allSongs, allScores, importedScore, showChinaVersion, showProjectedRating, onPress, onLongPress, onRemove, onTarget }: Props) {
  const officialConstant = getOfficialChartConstant(music, entry.difficultyIndex);
  const targetRating = entry.targetScore === undefined ? null : calculateRating(officialConstant ?? undefined, entry.targetScore);
  // v1.12.0：达成目标后 B50 总分增量（重算口径），无目标不显示。
  const b50Gain = useMemo(() => (
    entry.targetScore === undefined
      ? null
      : computeB50Gain(allSongs, allScores, { songId: music.id, musicType: music.type, difficultyIndex: entry.difficultyIndex }, entry.targetScore)
  ), [allSongs, allScores, music.id, music.type, entry.difficultyIndex, entry.targetScore]);
  const chinaName = getChinaVersionName(music.basic_info.from);
  const difficultyColor = DifficultyColorMap[entry.difficultyIndex] || Colors.accent.secondary;
  const [editingTarget, setEditingTarget] = useState(false);
  const showTargetPicker = entry.targetScore === undefined || editingTarget;
  // v1.14.0：保留达标判定与「还差」字段，进度条已移除。
  const current = importedScore?.achievement ?? 0;
  const achieved = entry.targetScore !== undefined && current >= entry.targetScore;
  const chooseTarget = (score: number | null) => {
    onTarget(score);
    setEditingTarget(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.orderBadge, entry.pin && styles.orderBadgePinned]}><Text style={styles.orderText}>{index + 1}</Text></View>
      <View style={styles.card}>
        <Pressable style={({ pressed }) => [styles.songHeader, pressed && styles.pressed]} onPress={onPress} onLongPress={onLongPress} delayLongPress={260}>
          <CoverImage music={music} allSongs={allSongs} style={styles.cover} accessibilityLabel={`${music.title} 曲绘`} />
          <View style={styles.info}>
            <View style={styles.titleRow}>
              {entry.pin === 'top' && <Text style={styles.pinMark}>📌</Text>}
              {entry.pin === 'bottom' && <Text style={styles.pinMark}>🔻</Text>}
              <Text style={styles.title} numberOfLines={2}>{music.title}</Text>
            </View>
            <Text style={styles.artist} numberOfLines={1}>{music.basic_info.artist}</Text>
            <View style={styles.metaLine}>
              <Text style={[styles.diffChip, { color: difficultyColor, borderColor: `${difficultyColor}88`, backgroundColor: `${difficultyColor}1a` }]}>
                {DifficultyLabels[entry.difficultyIndex] || `难度 ${entry.difficultyIndex}`}
              </Text>
              <Text style={styles.meta}>{music.type} · {officialConstant === null ? '无定数' : `定数 ${officialConstant.toFixed(1)}`}</Text>
            </View>
            <Text style={styles.version} numberOfLines={1}>原始：{music.basic_info.from}</Text>
            {showChinaVersion && chinaName !== music.basic_info.from && <Text style={styles.version} numberOfLines={1}>国区：{chinaName}</Text>}
          </View>
          <Pressable hitSlop={8} onPress={onRemove} style={styles.remove}><Text style={styles.removeText}>✕</Text></Pressable>
        </Pressable>

        <View style={styles.divider} />
        {showTargetPicker ? (
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>{editingTarget ? '修改目标' : '目标达成率'}</Text>
            {[100, 100.5].map(target => <Pressable key={target} style={styles.targetPreset} onPress={() => chooseTarget(target)}><Text style={styles.targetPresetText}>{target}</Text></Pressable>)}
            {editingTarget && <Pressable style={styles.clearTarget} onPress={() => chooseTarget(null)}><Text style={styles.clearTargetText}>清除</Text></Pressable>}
          </View>
        ) : (
          <Pressable style={styles.targetSummary} onPress={() => setEditingTarget(true)}>
            <Text style={styles.targetSummaryText}>目标：{entry.targetScore!.toFixed(4)}%</Text>
            {showProjectedRating && <Text style={styles.targetRating}>目标 Rating：{targetRating ?? '—'}{b50Gain !== null ? `（${b50Gain >= 0 ? '+' : ''}${b50Gain}）` : ''}</Text>}
            {/* v1.16.3：已选目标的条目不再显示「点击重新选择」提示，压缩卡片高度。 */}
          </Pressable>
        )}
        {officialConstant === null && <Text style={styles.warning}>宴会场或数据缺失：不计算官方目标 Rating。</Text>}
        {importedScore ? (
          <Text style={styles.scoreText}>当前成绩：{formatAchievement(importedScore.achievement)} · DX {importedScore.dxScore}{importedScore.fc ? ` · ${formatClearStatus(importedScore.fc)}` : ''}{importedScore.fs ? ` · ${formatClearStatus(importedScore.fs)}` : ''}{importedScore.serverRating === undefined ? '' : ` · RA ${importedScore.serverRating}`}</Text>
        ) : <Text style={styles.scoreMuted}>当前成绩：尚未导入或没有匹配的成绩</Text>}
        {entry.targetScore !== undefined && achieved && (
          <Text style={[styles.progressText, styles.progressTextDone]}>已达标 ✓</Text>
        )}
        {entry.note && <Text style={styles.note}>💬 {entry.note}</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingVertical: 5 },
  orderBadge: { position: 'absolute', top: 14, left: 7, zIndex: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  orderBadgePinned: { backgroundColor: Colors.accent.secondaryDark },
  orderText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  pinMark: { fontSize: 11 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  diffChip: { fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  card: { padding: 10, paddingLeft: 15, borderRadius: 13, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light, gap: 7 },
  songHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.75 },
  cover: { width: 64, height: 64, borderRadius: 9, backgroundColor: Colors.bg.tertiary },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: Colors.text.primary },
  artist: { fontSize: 11, color: Colors.text.secondary },
  meta: { fontSize: 10, color: Colors.accent.secondary, fontWeight: '700' },
  version: { fontSize: 9, color: Colors.text.muted },
  remove: { alignSelf: 'flex-start', padding: 3 },
  removeText: { fontSize: 15, color: Colors.functional.danger, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.border.light },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  targetLabel: { fontSize: 11, color: Colors.text.secondary },
  targetPreset: { minWidth: 50, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 7, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  targetPresetText: { fontSize: 11, color: Colors.accent.primary, fontWeight: '800' },
  clearTarget: { paddingHorizontal: 6, paddingVertical: 5 },
  clearTargetText: { fontSize: 10, color: Colors.functional.danger, fontWeight: '700' },
  targetSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  targetSummaryText: { fontSize: 12, color: Colors.text.primary, fontWeight: '800' },
  targetRating: { fontSize: 12, color: Colors.accent.primary, fontWeight: '800' },
  editHint: { fontSize: 9, color: Colors.text.muted },
  progressText: { fontSize: 10.5, fontWeight: '700', color: Colors.text.secondary },
  progressTextDone: { color: Colors.functional.success, fontWeight: '800' },
  warning: { fontSize: 10, lineHeight: 14, color: Colors.functional.warning },
  scoreText: { fontSize: 11, lineHeight: 16, color: Colors.functional.success },
  scoreMuted: { fontSize: 11, color: Colors.text.muted },
  note: { fontSize: 11, color: Colors.text.secondary },
});
