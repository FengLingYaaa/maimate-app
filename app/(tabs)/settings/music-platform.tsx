import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../../src/constants';
import { MUSIC_PLATFORM_OPTIONS } from '../../../src/data/settings-options';
import { getMusicPlatformAppUrls } from '../../../src/data/music-platforms';
import { useSettingsStore } from '../../../src/store';

export default function MusicPlatformSettings() {
  const router = useRouter();
  const current = useSettingsStore(s => s.settings.defaultMusicPlatform);
  const appSearchFirst = useSettingsStore(s => s.settings.musicAppSearchFirst);
  const updateSettings = useSettingsStore(s => s.updateSettings);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '默认音乐平台', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <Text style={styles.hint}>详情页点击音乐搜索时的跳转行为；深链失败会自动回退网页搜索。</Text>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>优先打开应用（实验）</Text>
            <Text style={styles.subLabel}>尝试客户端搜索深链，各平台路由无官方文档，可能落在首页</Text>
          </View>
          <Switch
            value={appSearchFirst}
            onValueChange={value => { void updateSettings({ musicAppSearchFirst: value }); }}
            trackColor={{ true: `${Colors.accent.primary}88`, false: Colors.bg.tertiary }}
            thumbColor={appSearchFirst ? Colors.accent.primary : Colors.text.muted}
          />
        </View>
        <Text style={styles.diagTitle}>候选深链（真机点测用）· 当前默认平台</Text>
        {getMusicPlatformAppUrls(current, '示例曲名', '示例曲师').map(url => (
          <Text key={url} style={styles.diagItem} numberOfLines={2}>{url}</Text>
        ))}
        <Text style={styles.diagHint}>以上为搜索关键词占位示例；有效路由会被自动记忆使用，无需手动配置。</Text>
      </View>

      <Text style={[styles.hint, { marginTop: 4 }]}>选择点击搜索按钮时使用的默认平台：</Text>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  label: { fontSize: 15, color: Colors.text.primary, fontWeight: '700' },
  subLabel: { fontSize: 11, lineHeight: 15, color: Colors.text.muted, marginTop: 3 },
  diagTitle: { fontSize: 11, fontWeight: '800', color: Colors.accent.secondary, paddingHorizontal: 16, paddingTop: 12 },
  diagItem: { fontSize: 10, lineHeight: 14, color: Colors.text.secondary, paddingHorizontal: 16, paddingVertical: 3 },
  diagHint: { fontSize: 10, lineHeight: 14, color: Colors.text.muted, paddingHorizontal: 16, paddingBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  radio: { fontSize: 20, color: Colors.text.muted },
  radioActive: { color: Colors.accent.primary },
});
