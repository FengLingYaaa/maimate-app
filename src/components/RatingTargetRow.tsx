/** v1.19.0：目标 Rating 推荐行（B50 页卡片与目标 Rating 页共用）。 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { DifficultyLabels } from '../constants/game';
import { formatAchievement } from '../data/rating';
import type { RatingTargetCandidate } from '../data/next-rating-target';

export function RatingTargetRow({ candidate, onAdd, onOpen }: {
  candidate: RatingTargetCandidate;
  onAdd?: (candidate: RatingTargetCandidate) => void;
  onOpen?: (candidate: RatingTargetCandidate) => void;
}) {
  const color = DifficultyColorMap[candidate.difficultyIndex] ?? Colors.text.secondary;
  return (
    <Pressable style={styles.row} onPress={() => onOpen?.(candidate)} disabled={!onOpen}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>{candidate.title}</Text>
        <Text style={styles.rowSub}>
          <Text style={{ color, fontWeight: '800' }}>{DifficultyLabels[candidate.difficultyIndex] ?? candidate.difficultyIndex}</Text>
          {` ${candidate.ds.toFixed(1)} · ${candidate.pool === 'new' ? 'B15' : 'B35'} · `}
          {candidate.currentAchievement === null ? '未游玩' : formatAchievement(candidate.currentAchievement)} → {formatAchievement(candidate.targetAchievement)}
        </Text>
        {candidate.tapGreatAllowance !== null && (
          <Text style={styles.rowHint}>约可丢 {candidate.tapGreatAllowance} 个 Tap GREAT（绝赞全 CP）</Text>
        )}
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.gain}>+{candidate.gain}</Text>
        {candidate.inPlan ? (
          <Text style={styles.inPlan}>已在计划</Text>
        ) : onAdd ? (
          <Pressable style={styles.addButton} onPress={() => onAdd(candidate)} hitSlop={6}>
            <Text style={styles.addText}>加入计划</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  rowSub: { fontSize: 11, color: Colors.text.secondary },
  rowHint: { fontSize: 10, color: Colors.text.muted },
  rowSide: { alignItems: 'flex-end', gap: 4 },
  gain: { fontSize: 16, fontWeight: '900', color: Colors.functional.success },
  inPlan: { fontSize: 10, fontWeight: '800', color: Colors.text.muted },
  addButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.accent.primary },
  addText: { fontSize: 10, fontWeight: '800', color: Colors.accent.primary },
});
