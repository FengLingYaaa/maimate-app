import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants';
import { MUSIC_PLATFORM_LABELS } from '../data/music-platforms';
import type { MusicPlatform } from '../data/types';

interface Props {
  defaultPlatform: MusicPlatform;
  defaultCollapsed?: boolean;
  /** 打开搜索前要复制到剪贴板的曲名+曲师关键词。 */
  searchText: string;
  onOpen: (platform: MusicPlatform) => void;
}

/** 歌曲详情页「音乐平台搜索」板块：默认折叠，展开后按平台跳转搜索。 */
export function MusicPlatformBoard({ defaultPlatform, defaultCollapsed = false, searchText, onOpen }: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const copySearchText = async () => {
    try {
      await Clipboard.setStringAsync(searchText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 复制失败时不做处理。
    }
  };

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
          <View style={styles.copyRow}>
            <Text style={styles.copyHint} numberOfLines={1}>{searchText}</Text>
            <Pressable style={[styles.copyButton, copied && styles.copyButtonActive]} onPress={() => void copySearchText()}>
              <Text style={[styles.copyButtonText, copied && styles.copyButtonTextActive]}>{copied ? '✓ 已复制' : '复制搜索词'}</Text>
            </Pressable>
          </View>
          <Text style={styles.platformNote}>跳转前会先把曲名+曲师复制到剪贴板；若客户端深链未能自动填入搜索框，直接在应用内粘贴即可。</Text>
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
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.bg.secondary },
  copyHint: { flex: 1, fontSize: 11, color: Colors.text.secondary },
  copyButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: Colors.border.light },
  copyButtonActive: { borderColor: Colors.functional.success, backgroundColor: `${Colors.functional.success}18` },
  copyButtonText: { fontSize: 11, fontWeight: '700', color: Colors.text.secondary },
  copyButtonTextActive: { color: Colors.functional.success },
  platformNote: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
});
