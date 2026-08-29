import React, { useRef } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../../src/constants';

export default function SettingsStackLayout() {
  const router = useRouter();
  // v1.16.3：简化归位——不比较 pathname（v1.16.1 的 pathname 比较在栈内导航时误伤）。
  // 仅在「从其它 tab 切回设置」时 replace 回设置首页，栈内导航不受影响。
  const firstFocus = useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      router.replace('/settings');
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
      <Stack.Screen name="update" options={{ title: '检查更新' }} />
    </Stack>
  );
}
