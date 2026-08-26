import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';
import { MUSIC_PLATFORM_LABELS } from '../data/music-platforms';
import type { MusicPlatform } from '../data/types';

interface Props {
  defaultPlatform: MusicPlatform;
  defaultCollapsed?: boolean;
  onOpen: (platform: MusicPlatform) => void;
}

/** 歌曲详情页「音乐平台搜索」板块：默认折叠，展开后按平台跳转搜索。 */
export function MusicPlatformBoard({ defaultPlatform, defaultCollapsed = false, onOpen }: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  return (
    <View style={styles.platformCard}>
      <Pressable style={styles.platformHeader} onPress={() => setExpanded(value => !value)}>
        <View style={styles.headerText}>
          <Text style={styles.platformTitle}>音乐平台搜索</Text>
          {!expanded && <Text style={styles.summary}>默认：{MUSIC_PLATFORM_LABELS[defaultPlatform]}</Text>}
        </View>
        <Text style={styles.toggle}>{expanded ? '▲ 收起' : '▼ 展开'}</Text>
      </Pressable>
      {expanded && (
        <>
          <View style={styles.platformRow}>
            {(Object.keys(MUSIC_PLATFORM_LABELS) as MusicPlatform[]).map(platform => (
              <Pressable key={platform} style={[styles.platformButton, platform === defaultPlatform && styles.platformButtonActive]} onPress={() => onOpen(platform)}>
                <Text style={[styles.platformButtonText, platform === defaultPlatform && styles.platformButtonTextActive]}>{MUSIC_PLATFORM_LABELS[platform]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.platformNote}>直接打开音乐平台的网页搜索结果页，可立即查看候选曲目；平台应用内的深链搜索由客户端路由决定，不做保证。</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  platformCard: { padding: 12, borderRadius: 12, backgroundColor: Colors.bg.tertiary, gap: 10 },
  platformHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: 3, paddingRight: 8 },
  platformTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  summary: { fontSize: 11, color: Colors.text.muted },
  toggle: { fontSize: 11, color: Colors.text.muted, fontWeight: '700' },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.medium },
  platformButtonActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}18` },
  platformButtonText: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary },
  platformButtonTextActive: { color: Colors.accent.primary },
  platformNote: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
});
