/**
 * 更新日志浮层（v1.16.1）：新版本首次启动时展示当版更新内容。
 * 记录键为版本号（非布尔）——跨版本升级自然再次弹出；同版本只弹一次。
 * 自绘 overlay（非 RN Modal），风格与分享预览层一致。
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Colors } from '../constants';
import { getChangelogForVersion } from '../data/changelog';

const SEEN_KEY = 'maimate_changelog_seen_version';

export function ChangelogOverlay() {
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState<ReturnType<typeof getChangelogForVersion>>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const version = Constants.expoConfig?.version ?? null;
        if (!version) return;
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen === version) return;
        const current = getChangelogForVersion(version);
        if (!current) return;
        if (!cancelled) {
          setEntry(current);
          setVisible(true);
        }
      } catch {
        // 读取失败则不弹，不阻塞启动。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    const version = Constants.expoConfig?.version;
    if (version) {
      AsyncStorage.setItem(SEEN_KEY, version).catch(() => undefined);
    }
  };

  if (!visible || !entry) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.badge}>更新完成</Text>
        <Text style={styles.title}>v{entry.version} · {entry.date}</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {entry.highlights.map((line, index) => (
            <View key={index} style={styles.item}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.itemText}>{line}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.button} onPress={dismiss}>
          <Text style={styles.buttonText}>知道了</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8, 8, 16, 0.82)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 40, elevation: 40,
    padding: 28,
  },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.light,
    padding: 16, gap: 10,
  },
  badge: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '900', color: '#0f0f1a', backgroundColor: Colors.accent.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '900', color: Colors.text.primary },
  list: { maxHeight: 280 },
  item: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dot: { fontSize: 12, color: Colors.accent.secondary, fontWeight: '900' },
  itemText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: Colors.text.secondary },
  button: { backgroundColor: Colors.accent.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  buttonText: { fontSize: 13, fontWeight: '900', color: '#fff' },
});
