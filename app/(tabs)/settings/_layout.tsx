import React from 'react';
import { Stack, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { Colors } from '../../../src/constants';

export default function SettingsStackLayout() {
  const router = useRouter();
  const pathname = usePathname();
  // v1.16.0：每次聚焦设置 tab 强制回到设置首页——否则上次停留在子页
  // （如快照管理）时，切走再切回会直接恢复子页，不符合操作直觉。
  useFocusEffect(
    React.useCallback(() => {
      if (pathname !== '/settings') {
        router.replace('/settings');
      }
      // pathname 变化会重新触发；仅在聚焦时归位一次。
    }, [pathname, router]),
  );
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.bg.primary },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.bg.primary },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="data-backup" options={{ title: '数据备份' }} />
      <Stack.Screen name="snapshots" options={{ title: '快照管理' }} />
      <Stack.Screen name="update" options={{ title: '检查更新' }} />
    </Stack>
  );
}
