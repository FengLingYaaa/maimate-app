import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../src/constants';
import { MUSIC_PLATFORM_OPTIONS } from '../../src/data/settings-options';
import { useSettingsStore } from '../../src/store';

export default function MusicPlatformSettings() {
  const router = useRouter();
  const current = useSettingsStore(s => s.settings.defaultMusicPlatform);
  const updateSettings = useSettingsStore(s => s.updateSettings);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '默认音乐平台', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.hint}>详情页点击音乐搜索时，优先尝试打开已安装应用。</Text>
      <View style={styles.card}>
        {MUSIC_PLATFORM_OPTIONS.map(option => (
          <Pressable key={option.value} style={styles.row} onPress={() => { void updateSettings({ defaultMusicPlatform: option.value }); router.back(); }}>
            <Text style={styles.label}>{option.label}</Text>
            <Text style={[styles.radio, current === option.value && styles.radioActive]}>{current === option.value ? '●' : '○'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 22, backgroundColor: Colors.bg.primary, gap: 12 },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.text.muted },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.bg.secondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  label: { fontSize: 15, color: Colors.text.primary, fontWeight: '700' },
  radio: { fontSize: 20, color: Colors.text.muted },
  radioActive: { color: Colors.accent.primary },
});
