import React, { useRef } from 'react';
import { Stack, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { Colors } from '../../../src/constants';

export default function SettingsStackLayout() {
  const router = useRouter();
  const pathname = usePathname();
  // v1.16.1：pathname 只存 ref 不进依赖——否则栈内导航（pathname 变化）也会触发
  // 归位，把快照管理/检查更新等次级页弹回首页（v1.16.0 回归根因）。
  // 仅在布局真正聚焦（从其它 tab 切回）时检查一次并归位。
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const prevFocused = useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (prevFocused.current) {
        prevFocused.current = false;
        return;
      }
      if (pathnameRef.current !== '/settings') {
        router.replace('/settings');
      }
    }, [router]),
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
