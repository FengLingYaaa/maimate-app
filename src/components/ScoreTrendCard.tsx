/**
 * 单谱成绩曲线（v1.16.4）：从本地快照历史重建该谱面达成率随时间的变化。
 * 纯 SVG 折线（无依赖），无数据时整卡不渲染。放在详情页音乐平台板块下方。
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Colors } from '../constants';
import type { ScoreSnapshot } from '../data/types';

interface Props {
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  /** 本地快照（顺序无所谓，组件内按时间升序排序）。 */
  snapshots: ScoreSnapshot[];
}

interface Point {
  t: number;
  a: number;
}

const W = 300;
const H = 110;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

/** 纵轴下限：向下取整到 20% 的整数倍，让网格线落在整数刻度上。 */
function axisFloor(minA: number): number {
  return Math.max(0, Math.floor((minA - 2) / 20) * 20);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function ScoreTrendCard({ songId, musicType, difficultyIndex, snapshots }: Props) {
  const points = useMemo<Point[]>(() => {
    const list: Point[] = [];
    for (const snapshot of snapshots) {
      const score = snapshot.scores.find(item =>
        item.songId === songId
        && item.type === musicType
        && item.difficultyIndex === difficultyIndex);
      if (score && Number.isFinite(score.achievement) && score.achievement > 0) {
        list.push({ t: snapshot.syncedAt, a: score.achievement });
      }
    }
    list.sort((left, right) => left.t - right.t);
    return list;
  }, [difficultyIndex, musicType, songId, snapshots]);

  if (points.length === 0) return null;

  const values = points.map(point => point.a);
  const floor = axisFloor(Math.min(...values));
  const ceil = 101;
  const span = Math.max(1e-6, ceil - floor);

  const x = (index: number): number =>
    PAD_LEFT + (index / Math.max(1, points.length - 1)) * (W - PAD_LEFT - PAD_RIGHT);
  const y = (a: number): number =>
    PAD_TOP + (1 - (a - floor) / span) * (H - PAD_TOP - PAD_BOTTOM);

  const coords = points.map((point, index) => `${x(index)},${y(point.a)}`).join(' ');
  const delta = points.length >= 2 ? points[points.length - 1].a - points[0].a : null;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>📈 成绩曲线</Text>
        <Text style={styles.meta}>
          {points.length} 次快照{delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta.toFixed(4)}%` : ''}
        </Text>
      </View>
      <Svg width={W} height={H}>
        {[floor, (floor + ceil) / 2, ceil].map(value => (
          <Line
            key={value}
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={y(value)}
            y2={y(value)}
            stroke={value === floor ? Colors.border.medium : Colors.border.light}
            strokeDasharray={value === floor ? undefined : '3 4'}
            strokeWidth={1}
          />
        ))}
        {points.length >= 2 && (
          <Polyline
            points={coords}
            fill="none"
            stroke={Colors.accent.secondary}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((point, index) => (
          <Circle key={point.t} cx={x(index)} cy={y(point.a)} r={2.6} fill={Colors.accent.secondary} />
        ))}
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axisText}>{floor}%</Text>
        <Text style={styles.axisText}>{formatDate(points[0].t)} → {formatDate(points[points.length - 1].t)}</Text>
        <Text style={styles.axisText}>{ceil}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  title: { fontSize: 13.5, fontWeight: '900', color: Colors.text.primary },
  meta: { fontSize: 10.5, color: Colors.text.muted },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: PAD_LEFT - 24,
  },
  axisText: { fontSize: 9, color: Colors.text.muted },
});
