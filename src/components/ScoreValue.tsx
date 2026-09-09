import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';
import { formatAchievement } from '../data/rating';
import { formatClearStatus } from '../data/status-labels';
import type { PlayerScore } from '../data/types';

interface Props {
  score?: PlayerScore | null;
  showPlaceholder?: boolean;
  style?: object;
  valueStyle?: object;
  statusStyle?: object;
}

/** Compact achievement value used by score sorting views. */
export function ScoreValue({ score, showPlaceholder = true, style, valueStyle, statusStyle }: Props) {
  if (!score || !Number.isFinite(score.achievement)) {
    return showPlaceholder ? <Text style={[styles.placeholder, style]}>—</Text> : null;
  }
  const status = score.fc ? formatClearStatus(score.fc) : '';
  const statusColor = status === 'AP' || status === 'AP+'
    ? Colors.functional.warning
    : status === 'FC' || status === 'FC+'
      ? Colors.functional.success
      : Colors.text.secondary;
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.value, valueStyle]} numberOfLines={1}>{formatAchievement(score.achievement)}</Text>
      {!!status && <Text style={[styles.status, { color: statusColor }, statusStyle]} numberOfLines={1}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  value: { fontSize: 9, fontWeight: '800', color: Colors.accent.primary },
  status: { fontSize: 9, fontWeight: '900' },
  placeholder: { fontSize: 9, fontWeight: '800', color: Colors.text.muted },
});
