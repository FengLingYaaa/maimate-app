/**
 * 计划页环形进度条（v1.16.0）：SVG 圆环按完成比例填充，弧色随比例分档
 * （<30% 红、<70% 黄、≥70% 绿），达标整环金色。环心 x/y 文案与现有布局一致。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants';

const SIZE = 46;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * RADIUS;

function arcColor(ratio: number, allAchieved: boolean): string {
  if (allAchieved) return '#ffd166';
  if (ratio < 0.3) return Colors.functional.danger;
  if (ratio < 0.7) return '#ffd166';
  return Colors.functional.success;
}

interface Props {
  achieved: number;
  total: number;
  /** 平均完成率（%）。v1.16.1 起弧长与配色改用达标比例，此值仅保留兼容调用方。 */
  averagePercent: number;
  allAchieved: boolean;
}

export function PlanProgressRing({ achieved, total, averagePercent, allAchieved }: Props) {
  // v1.16.1：按达标比例（achieved/total）填充——平均完成率在成绩未导入时恒为 0，
  // 会导致圆环空转看不见；达标比例与环心 x/y 同口径，有达标即有弧。
  const ratio = total > 0 ? Math.max(0, Math.min(1, achieved / total)) : 0;
  const color = arcColor(ratio, allAchieved);
  return (
    <View style={styles.holder}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={Colors.border.medium} strokeWidth={STROKE} fill="none" />
        {ratio > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${CIRCUM * ratio} ${CIRCUM}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.text, allAchieved && styles.textDone]}>{achieved}/{total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  holder: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 11, fontWeight: '900', color: Colors.text.primary },
  textDone: { color: '#ffd166' },
});
