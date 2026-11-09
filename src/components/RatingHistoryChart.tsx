/**
 * Rating 历史折线图（v1.18.0）：SVG 绘制，X 轴按真实时间，Y 轴为总 Rating。
 * 只有 1 个点时只画一个点（不是线）。
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Colors } from '../constants';
import type { RatingHistoryPoint } from '../data/rating-history';

const HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 28;
const LINE_COLOR = Colors.accent.primary;

function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Y 轴范围：上下各留一点余量，并取整到 5/10/50 的倍数。 */
function niceRange(min: number, max: number): { low: number; high: number; step: number } {
  const span = Math.max(max - min, 20);
  const rawStep = span / 3;
  const step = rawStep <= 5 ? 5 : rawStep <= 10 ? 10 : rawStep <= 25 ? 25 : rawStep <= 50 ? 50 : 100;
  const low = Math.floor((min - span * 0.15) / step) * step;
  const high = Math.ceil((max + span * 0.15) / step) * step;
  return { low, high, step };
}

export function RatingHistoryChart({ points }: { points: RatingHistoryPoint[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height: HEIGHT }]}>
        <Text style={styles.emptyText}>还没有记录。同步一次成绩后这里会出现第一个点。</Text>
      </View>
    );
  }

  const ratings = points.map(point => point.totalRating);
  const times = points.map(point => Date.parse(point.at));
  const { low, high, step } = niceRange(Math.min(...ratings), Math.max(...ratings));
  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const single = points.length === 1 || maxTime === minTime;
  const x = (time: number) => PAD_LEFT + (single ? plotWidth / 2 : ((time - minTime) / (maxTime - minTime)) * plotWidth);
  const y = (rating: number) => PAD_TOP + (1 - (rating - low) / (high - low)) * plotHeight;

  const coords = points.map((point, index) => ({ x: x(times[index]), y: y(point.totalRating) }));
  const linePath = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(' ');
  const baseY = PAD_TOP + plotHeight;
  const areaPath = single ? '' : `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`;
  const ticks: number[] = [];
  for (let value = low; value <= high + 1e-9; value += step) ticks.push(value);
  // X 轴标签：首、尾，点够多时加中间一个。
  const labelIndices = single ? [0] : points.length >= 5 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0, points.length - 1];
  const last = coords[coords.length - 1];
  const lastRating = ratings[ratings.length - 1];

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="ratingArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={LINE_COLOR} stopOpacity={0.32} />
              <Stop offset="1" stopColor={LINE_COLOR} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map(value => (
            <React.Fragment key={value}>
              <Line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(value)} y2={y(value)} stroke={Colors.border.light} strokeWidth={1} strokeDasharray="3 4" />
              <SvgText x={PAD_LEFT - 6} y={y(value) + 4} fontSize={10} fill={Colors.text.muted} textAnchor="end">{value}</SvgText>
            </React.Fragment>
          ))}
          {!single && <Path d={areaPath} fill="url(#ratingArea)" />}
          {!single && <Path d={linePath} stroke={LINE_COLOR} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
          {coords.map((coord, index) => (
            <Circle
              key={points[index].at}
              cx={coord.x}
              cy={coord.y}
              r={index === coords.length - 1 ? 5 : 3}
              fill={index === coords.length - 1 ? LINE_COLOR : Colors.bg.primary}
              stroke={LINE_COLOR}
              strokeWidth={2}
            />
          ))}
          <SvgText
            x={Math.min(last.x, width - PAD_RIGHT)}
            y={Math.max(last.y - 10, 12)}
            fontSize={12}
            fontWeight="bold"
            fill={Colors.text.primary}
            textAnchor={single ? 'middle' : 'end'}
          >
            {lastRating}
          </SvgText>
          {labelIndices.map(index => (
            <SvgText
              key={`x-${index}`}
              x={coords[index].x}
              y={HEIGHT - 8}
              fontSize={10}
              fill={Colors.text.muted}
              textAnchor={single ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            >
              {formatDay(points[index].at)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 12, lineHeight: 18, color: Colors.text.muted, textAlign: 'center' },
});
