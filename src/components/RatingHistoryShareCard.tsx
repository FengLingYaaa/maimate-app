/**
 * v1.19.0 Rating 历史分享卡（宽 344，与 B50 分享卡一致）。
 * 点太少（<2）只显示当前 Rating，不画曲线。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RatingHistoryChart } from './RatingHistoryChart';
import type { RatingHistoryShareData } from '../data/rating-history';

export interface RatingHistoryShareCardProps {
  data: RatingHistoryShareData;
  rangeLabel: string;
  userName?: string;
}

const CARD_WIDTH = 344;
const CHART_WIDTH = CARD_WIDTH - 24;

function day(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function RatingHistoryShareCard({ data, rangeLabel, userName }: RatingHistoryShareCardProps) {
  const deltaText = data.delta > 0 ? `+${data.delta}` : String(data.delta);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MaiMate · Rating 历史</Text>
          {!!userName && <Text style={styles.userName}>{userName}</Text>}
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalValue}>{data.latest}</Text>
          <Text style={styles.totalLabel}>当前 Rating</Text>
        </View>
      </View>
      {data.drawCurve ? (
        <>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{rangeLabel}涨幅</Text>
              <Text style={[styles.chipValue, { color: data.delta >= 0 ? '#3dd68c' : '#ff6b6b' }]}>{deltaText}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>最高</Text>
              <Text style={styles.chipValue}>{data.max}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>记录</Text>
              <Text style={styles.chipValue}>{data.count} 次</Text>
            </View>
          </View>
          <View style={styles.chartBox}>
            <RatingHistoryChart points={data.points} fixedWidth={CHART_WIDTH} height={180} />
          </View>
          <Text style={styles.range}>{day(data.fromAt)} – {day(data.toAt)} · {data.first} → {data.latest}</Text>
        </>
      ) : (
        <Text style={styles.single}>刚开始记录，下次同步后会出现曲线。</Text>
      )}
      <Text style={styles.footer}>maimate.flya.ccwu.cc · {new Date().toLocaleDateString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, backgroundColor: '#14142b', borderRadius: 16, padding: 12, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  appName: { fontSize: 13, fontWeight: '900', color: '#ff6b9d' },
  userName: { fontSize: 11, color: '#9888b0', marginTop: 2 },
  totalWrap: { alignItems: 'flex-end' },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#f0e6ff' },
  totalLabel: { fontSize: 9, color: '#9888b0' },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: '#1e1e38', borderRadius: 8, paddingVertical: 5, alignItems: 'center' },
  chipLabel: { fontSize: 8.5, color: '#9888b0' },
  chipValue: { fontSize: 14, fontWeight: '900', color: '#f0e6ff' },
  chartBox: { backgroundColor: '#1a1a34', borderRadius: 10, overflow: 'hidden' },
  range: { fontSize: 9.5, color: '#9888b0', textAlign: 'center' },
  single: { fontSize: 11, color: '#9888b0', textAlign: 'center', paddingVertical: 8 },
  footer: { fontSize: 8, color: '#5a4a6e', textAlign: 'center', marginTop: 2 },
});
