/**
 * MaiMate Root Layout
 * 根 Stack：(tabs) 主框架 + song 歌曲详情。
 * 详情页压在 Tabs 之上，返回时自然回到进入前的 Tab
 * （修复此前从详情返回总是落在推分计划的问题）。
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../src/constants';
import { ChangelogOverlay } from '../src/components/ChangelogOverlay';
import { useBilibiliStore, useMusicStore, usePlanStore, useScoreStore, useSettingsStore } from '../src/store';

export default function RootLayout() {
  const loadData = useMusicStore(s => s.loadData);
  const loading = useMusicStore(s => s.loading);
  const loadPlan = usePlanStore(s => s.loadPlan);
  const loadScores = useScoreStore(s => s.loadScores);
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadBilibiliLinks = useBilibiliStore(s => s.loadLinks);

  useEffect(() => {
    loadData();
    loadPlan();
    loadScores();
    loadSettings();
    loadBilibiliLinks();
  }, []);

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>🎵 正在加载曲库...</Text>
          <Text style={styles.loadingSub}>数据来源: Diving-Fish 舞萌DX查分器</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg.primary },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="song" />
        <Stack.Screen name="b50" />
        <Stack.Screen
          name="snapshots"
          options={{
            headerShown: true,
            title: '快照管理',
            headerStyle: { backgroundColor: Colors.bg.primary },
            headerTintColor: Colors.text.primary,
            contentStyle: { backgroundColor: Colors.bg.primary },
          }}
        />
      </Stack>
      {/* v1.16.1：新版本首次启动的更新日志浮层，覆盖在最上层。 */}
      <ChangelogOverlay />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  loadingSub: {
    fontSize: 12,
    color: Colors.text.muted,
  },
});
