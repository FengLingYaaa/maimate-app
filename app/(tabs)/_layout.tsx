/**
 * MaiMate Tabs Layout
 * Expo Router Tabs: 曲库 | 抽歌 | 牌子 | 计划 | 运势 | 设置
 * 挂在根 Stack 的 (tabs) 分组下；song 详情在根 Stack，返回即回原 Tab。
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { Colors } from '../../src/constants';

export default function TabsLayout() {
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
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
          }}
        />
      </Tabs>
    </>
  );
}
