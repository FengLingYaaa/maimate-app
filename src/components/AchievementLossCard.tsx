/**
 * 完成率损失试算卡片。
 * 展示当前难度谱面在各判定下单个音符损失的达成率百分点，
 * 以及等效「Tap 打 Great」个数；两种口径按钮切换。
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';
import { computeAchievementLoss, type LossCell } from '../data/achievement-loss';

interface Props {
  /** DF 谙面 notes 数组：DX=[TAP,HOLD,SLIDE,TOUCH,BREAK]，SD=[TAP,HOLD,SLIDE,BREAK]。 */
  notes: number[];
  /** 打开详情页时的初始折叠状态（设置页可配置）。 */
  defaultCollapsed?: boolean;
}

type Mode = 'percent' | 'eqTap';

/** 展示的判定列：CP 永不失完成率，不参与损失展示。颜色区分判定档位。 */
const VISIBLE_JUDGMENTS: Array<{ key: string; label: string; color: string }> = [
  { key: 'p2550', label: 'P·2550', color: '#fb923c' },
  { key: 'p2500', label: 'P·2500', color: '#fb923c' },
  { key: 'g2000', label: 'G·2000', color: Colors.accent.primary },
  { key: 'g1500', label: 'G·1500', color: Colors.accent.primary },
  { key: 'g1250', label: 'G·1250', color: Colors.accent.primary },
  { key: 'good', label: 'Good', color: Colors.functional.success },
  { key: 'miss', label: 'Miss', color: Colors.text.muted },
];

export function AchievementLossCard({ notes, defaultCollapsed = false }: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [mode, setMode] = useState<Mode>('percent');

  const result = useMemo(() => {
    const isDxLayout = notes.length >= 5;
    const tap = notes[0] ?? 0;
    const hold = notes[1] ?? 0;
    const slide = notes[2] ?? 0;
    const touch = isDxLayout ? notes[3] ?? 0 : 0;
    const breaks = (isDxLayout ? notes[4] : notes[3]) ?? 0;
    return computeAchievementLoss({
      tap, hold, slide,
      touch: touch > 0 ? touch : undefined,
      breaks,
    });
  }, [notes]);

  const formatCell = (cell: LossCell): string => {
    if (mode === 'percent') {
      return cell.percent === 0 ? '—' : `${cell.percent.toFixed(4)}%`;
    }
    return !Number.isFinite(cell.eqTapGreat) || cell.eqTapGreat === 0 ? '—' : `${cell.eqTapGreat.toFixed(1)}`;
  };

  const rows: Array<{ label: string; cells: Record<string, LossCell> }> = [
    ...result.regularRows.map(row => ({ label: `${row.label} ×${row.count}`, cells: row.losses })),
    ...(result.breakRows ? [{ label: `Break ×${(notes.length >= 5 ? notes[4] : notes[3]) ?? 0}`, cells: result.breakRows.total }] : []),
  ];

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded(value => !value)}>
        <Text style={styles.title}>🎯 完成率损失</Text>
        <Text style={styles.toggle}>{expanded ? '▲ 收起' : '▼ 展开'}</Text>
      </Pressable>

      {expanded && (
        <>
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeBtn, mode === 'percent' && styles.modeBtnOn]} onPress={() => setMode('percent')}>
              <Text style={[styles.modeBtnText, mode === 'percent' && styles.modeBtnTextOn]}>达成率损失</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn, mode === 'eqTap' && styles.modeBtnOn]} onPress={() => setMode('eqTap')}>
              <Text style={[styles.modeBtnText, mode === 'eqTap' && styles.modeBtnTextOn]}>等效 Great·Tap</Text>
            </Pressable>
          </View>

          {/* v1.16.9：音符类型列固定在左侧（不随横向滚动），仅判定数据列滚动。 */}
          <View style={styles.tableWrap}>
            <View style={styles.typeColumn}>
              <View style={[styles.cell, styles.typeCell]}><Text style={styles.typeText}>音符</Text></View>
              {rows.map(row => (
                <View key={row.label} style={[styles.cell, styles.typeCell]}><Text style={styles.typeText}>{row.label}</Text></View>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dataScroll}>
              <View>
                <View style={styles.row}>
                  {VISIBLE_JUDGMENTS.map(judgment => (
                    <View key={judgment.key} style={[styles.cell, styles.headCell]}><Text style={[styles.headText, { color: judgment.color }]}>{judgment.label}</Text></View>
                  ))}
                </View>
                {rows.map(row => (
                  <View key={row.label} style={styles.row}>
                    {VISIBLE_JUDGMENTS.map(judgment => (
                      <View key={judgment.key} style={styles.cell}>
                        <Text style={[styles.valueText, { color: judgment.color }]}>{formatCell(row.cells[judgment.key])}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* v1.15.2：等效容错 —— 101%→100.5% 的 0.5 个百分点可折合多少个 Tap(Great)，只依赖谱面，与成绩无关。 */}
          {result.tapGreatUnit > 0 && (
            <Text style={styles.toleranceLine}>
              等效容错 ≈ {Math.floor(0.5 / result.tapGreatUnit * 10) / 10} 个 Tap(Great)
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingVertical: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  toggle: { fontSize: 12, color: Colors.accent.secondary, fontWeight: '700' },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
  },
  modeBtnOn: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  modeBtnText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '700' },
  modeBtnTextOn: { color: Colors.accent.primary },
  row: { flexDirection: 'row' },
  // v1.16.9：表格布局——左列（音符类型）固定，右列（判定数据）横向滚动。
  tableWrap: { flexDirection: 'row' },
  typeColumn: { width: 92 },
  dataScroll: { flex: 1 },
  cell: {
    width: 74,
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  typeCell: { width: 92, alignItems: 'flex-start', paddingLeft: 16 },
  headCell: { borderBottomWidth: 0 },
  headText: { fontSize: 10, color: Colors.text.muted, fontWeight: '800' },
  typeText: { fontSize: 11, color: Colors.text.primary, fontWeight: '700' },
  valueText: { fontSize: 10.5, color: Colors.text.secondary },
  hint: { fontSize: 10, lineHeight: 15, color: Colors.text.muted, paddingHorizontal: 16 },
  toleranceLine: { fontSize: 11, fontWeight: '800', color: Colors.accent.primary, paddingHorizontal: 16 },
});
