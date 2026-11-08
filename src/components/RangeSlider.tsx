import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors } from '../constants';
import {
  applyRangeEdge,
  parseRangeInput,
  stepRangeEdge,
  type RangeEdge,
} from '../data/range-input';

interface Props {
  value: [number, number];
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: [number, number]) => void;
  label?: string;
}

/**
 * 定数范围条。
 * - 拖动滑块粗调；
 * - 两侧 −/＋ 按钮按 step（默认 0.1）微调；
 * - 点右侧数字直接输入精确值（失焦或按完成后生效，非法输入自动还原）。
 * 横向布局保留：竖向滑块会与筛选面板的上下滚动手势冲突，见 docs/DESIGN.md。
 */
export function RangeSlider({
  value,
  min = 0,
  max = 15,
  step = 0.1,
  onChange,
  label = '定数范围',
}: Props) {
  const [lower, upper] = value;
  // Android's native Slider can quantize the final decimal steps incorrectly.
  // Store/render the slider in integer step units (0..150 for 0.0..15.0).
  const scale = Math.round(1 / step);
  const minUnit = Math.round(min * scale);
  const maxUnit = Math.round(max * scale);

  const [editing, setEditing] = useState<RangeEdge | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (edge: RangeEdge) => {
    setDraft((edge === 'lower' ? lower : upper).toFixed(1));
    setEditing(edge);
  };

  const commitEdit = () => {
    if (!editing) return;
    const parsed = parseRangeInput(draft, min, max, step);
    if (parsed !== null) onChange(applyRangeEdge(value, editing, parsed));
    setEditing(null);
  };

  const renderRow = (edge: RangeEdge) => {
    const current = edge === 'lower' ? lower : upper;
    const tint = edge === 'lower' ? Colors.accent.primary : Colors.accent.secondary;
    const isEditing = editing === edge;
    return (
      <View style={styles.sliderRow}>
        <Text style={styles.rowLabel}>{edge === 'lower' ? '下限' : '上限'}</Text>
        <Pressable
          accessibilityLabel={`${edge === 'lower' ? '下限' : '上限'}减少 ${step}`}
          hitSlop={6}
          style={styles.stepButton}
          onPress={() => onChange(stepRangeEdge(value, edge, -1, min, max, step))}
        >
          <Text style={[styles.stepText, { color: tint }]}>−</Text>
        </Pressable>
        <Slider
          style={styles.slider}
          minimumValue={minUnit}
          maximumValue={maxUnit}
          step={1}
          value={Math.round(current * scale)}
          minimumTrackTintColor={tint}
          maximumTrackTintColor={Colors.bg.secondary}
          thumbTintColor={tint}
          onValueChange={next => {
            onChange(applyRangeEdge(value, edge, Number((next / scale).toFixed(1))));
          }}
        />
        <Pressable
          accessibilityLabel={`${edge === 'lower' ? '下限' : '上限'}增加 ${step}`}
          hitSlop={6}
          style={styles.stepButton}
          onPress={() => onChange(stepRangeEdge(value, edge, 1, min, max, step))}
        >
          <Text style={[styles.stepText, { color: tint }]}>＋</Text>
        </Pressable>
        {isEditing ? (
          <TextInput
            style={[styles.valueBox, styles.valueInput, { borderColor: tint, color: tint }]}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={5}
          />
        ) : (
          <Pressable
            accessibilityLabel={`输入${edge === 'lower' ? '下限' : '上限'}`}
            style={[styles.valueBox, { borderColor: `${tint}66` }]}
            onPress={() => startEdit(edge)}
          >
            <Text style={[styles.valueText, { color: tint }]}>{current.toFixed(1)}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>点数字可直接输入</Text>
      </View>
      {renderRow('lower')}
      {renderRow('upper')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  hint: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rowLabel: {
    width: 28,
    fontSize: 11,
    color: Colors.text.secondary,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.secondary,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  slider: {
    flex: 1,
    height: 34,
  },
  valueBox: {
    width: 54,
    height: 30,
    marginLeft: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.secondary,
  },
  valueInput: {
    paddingVertical: 0,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
