/**
 * DifficultyBadge — 难度色标徽章
 * 显示绿/黄/红/紫/白 圆形 + 等级标签
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DifficultyColorMap, Colors } from '../constants';

interface Props {
  index: number;          // 难度索引 0-4
  level: string;          // 等级标签如 "12+"
  ds?: number;            // 定数（可选）
  size?: 'sm' | 'md' | 'lg';
  highlighted?: boolean;  // 是否高亮（选中态）
}

export function DifficultyBadge({ index, level, ds, size = 'md', highlighted = false }: Props) {
  const color = DifficultyColorMap[index] || Colors.difficulty.basic;

  const sizes = {
    sm: { badge: 28, font: 10 },
    md: { badge: 36, font: 13 },
    lg: { badge: 44, font: 16 },
  };
  const s = sizes[size];

  return (
    <View style={[
      styles.container,
      {
        width: s.badge,
        height: s.badge,
        borderRadius: s.badge / 2,
        backgroundColor: highlighted ? color : `${color}22`,
        borderColor: color,
        borderWidth: highlighted ? 2 : 1,
      },
    ]}>
      <Text style={[
        styles.label,
        {
          fontSize: s.font,
          color: highlighted ? '#fff' : color,
        },
      ]}>
        {level}
      </Text>
      {ds !== undefined && size === 'lg' && (
        <Text style={[styles.ds, { color }]}>{ds.toFixed(1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
  },
  ds: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
});