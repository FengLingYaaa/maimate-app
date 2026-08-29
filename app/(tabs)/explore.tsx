/**
 * 信息查询（v1.15.1）：聚合 B50（含拟合 50）、牌子查询、今日运势、快照管理入口。
 * 纯入口页：各功能页面本身不变，仍走原路由。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../src/constants';

const ENTRIES: Array<{
  key: string;
  icon: string;
  title: string;
  desc: string;
  route: string;
  accent: string;
}> = [
  {
    key: 'b50',
    icon: '📊',
    title: 'B50 总览',
    desc: '官方 B50 与拟合 50 双模式，列表/网格、多选入计划、分享查分卡',
    route: '/b50',
    accent: Colors.accent.primary,
  },
  {
    key: 'plates',
    icon: '🏅',
    title: '牌子查询',
    desc: '按版本/难度/等级组合查牌，完成度一览，支持定数标注与筛选',
    route: '/plates',
    accent: '#00d4ff',
  },
  {
    key: 'fortune',
    icon: '🔮',
    title: '今日运势',
    desc: '每日抽签：今日推荐曲目与运势指数',
    route: '/fortune',
    accent: '#c44dff',
  },
  {
    key: 'snapshots',
    icon: '📷',
    title: '快照管理',
    desc: '本地成绩快照与推分战报对比',
    route: '/snapshots',
    accent: Colors.functional.success,
  },
];

export default function ExplorePage() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔎 信息查询</Text>
        <Text style={styles.headerSub}>牌子、运势、B50 与快照，都在这里</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {ENTRIES.map(entry => (
          <Pressable
            key={entry.key}
            style={styles.card}
            onPress={() => router.push(entry.route as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${entry.accent}1a`, borderColor: `${entry.accent}55` }]}>
              <Text style={styles.icon}>{entry.icon}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{entry.title}</Text>
              <Text style={styles.desc}>{entry.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: 16, paddingTop: 58, paddingBottom: 6 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  headerSub: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  content: { padding: 14, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bg.secondary, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  iconWrap: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: Colors.text.primary },
  desc: { fontSize: 11.5, lineHeight: 16, color: Colors.text.muted },
  chevron: { fontSize: 18, color: Colors.text.muted },
});
