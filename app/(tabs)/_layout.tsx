/**
 * MaiMate Tabs Layout
 * Expo Router Tabs: 曲库 | 抽歌 | 牌子 | 计划 | 运势 | 设置
 * 挂在根 Stack 的 (tabs) 分组下；song 详情在根 Stack，返回即回原 Tab。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Colors } from '../../src/constants';
import { autoCheckForUpdate, hasUpdateBadge } from '../../src/api/app-update';

function SettingsTabIcon({ color, badge }: { color: ColorValue; badge: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={{ fontSize: 20, color }}>⚙️</Text>
      {badge && <View style={styles.badgeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  const [updateBadge, setUpdateBadge] = useState(false);
  const currentVersion = Constants.expoConfig?.version ?? 'unknown';

  // 启动后延迟静默检查（内部 ≥24h 节流），有新版则点亮设置 Tab 红点。
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      autoCheckForUpdate(currentVersion)
        .catch(() => undefined)
        .finally(() => {
          hasUpdateBadge(currentVersion)
            .then(badge => {
              if (!cancelled) setUpdateBadge(badge);
            })
            .catch(() => undefined);
        });
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentVersion]);

  // 回到 Tabs 前台时复核红点（进入更新页「查看」后应熄灭）。
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    hasUpdateBadge(currentVersion)
      .then(badge => {
        if (!cancelled) setUpdateBadge(badge);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentVersion]));

  return (
    <>
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
          name="plates"
          options={{
            title: '牌子',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏅</Text>,
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
            tabBarIcon: ({ color }) => <SettingsTabIcon color={color} badge={updateBadge} />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  badgeDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.functional.danger,
    borderWidth: 1.5,
    borderColor: Colors.bg.secondary,
  },
});
