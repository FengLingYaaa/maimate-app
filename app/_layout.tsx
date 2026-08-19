/**
 * MaiMate Root Layout
 * Expo Router Tabs: 抽歌 | 曲库 | 计划
 */

import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../src/constants';
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
      <View style={styles.loading}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>🎵 正在加载曲库...</Text>
        <Text style={styles.loadingSub}>数据来源: Diving-Fish 舞萌DX查分器</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.bg.secondary,
            borderTopColor: Colors.border.light,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarActiveTintColor: Colors.accent.primary,
          tabBarInactiveTintColor: Colors.text.muted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '曲库',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎵</Text>,
          }}
        />
        <Tabs.Screen
          name="random"
          options={{
            title: '抽歌',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎲</Text>,
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: '推分计划',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
          }}
        />
        <Tabs.Screen
          name="fortune"
          options={{
            title: '今日运势',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔮</Text>,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: '设置',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
          }}
        />
        <Tabs.Screen name="plates" options={{ href: null }} />
        <Tabs.Screen name="settings/music-platform" options={{ href: null }} />
        <Tabs.Screen name="settings/sort" options={{ href: null }} />
        <Tabs.Screen name="song/[id]" options={{ href: null }} />
      </Tabs>
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