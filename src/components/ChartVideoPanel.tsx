import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import { getBilibiliSearchUrl, getChartVideos, isVideoDifficulty } from '../data/chart-videos';

interface Props {
  songId: string;
  songTitle: string;
  difficultyIndex: number;
}

const VIDEO_KIND_LABELS = {
  chart_confirm: '谱面确认',
  hand: '手元',
} as const;

export function ChartVideoPanel({ songId, songTitle, difficultyIndex }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isVideoDifficulty(difficultyIndex)) return null;

  const videos = getChartVideos(songId, difficultyIndex);
  const difficultyLabel = DifficultyLabels[difficultyIndex];
  const searchUrl = getBilibiliSearchUrl(songTitle, difficultyLabel);
  const difficultyColor = DifficultyColorMap[difficultyIndex];

  const openUrl = (url: string) => {
    void Linking.openURL(url);
  };

  const copyUrl = async (id: string, url: string) => {
    await Clipboard.setStringAsync(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(current => current === id ? null : current), 1600);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Bilibili 视频</Text>
        <Text style={[styles.difficulty, { color: difficultyColor }]}>{difficultyLabel}</Text>
      </View>
      <Text style={styles.caption}>仅展示红、紫、白谱；视频目录由人工整理，不在客户端抓取。</Text>

      {videos.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>暂无已确认的视频</Text>
          <Pressable style={styles.searchButton} onPress={() => openUrl(searchUrl)}>
            <Text style={styles.searchButtonText}>去 Bilibili 搜索该谱面</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.videoList}>
          {videos.map(video => (
            <View key={video.id} style={styles.videoRow}>
              <View style={styles.videoInfo}>
                <Text style={styles.videoKind}>{VIDEO_KIND_LABELS[video.kind]}</Text>
                <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                <Text style={styles.uploader}>UP：{video.uploader}</Text>
              </View>
              <View style={styles.videoActions}>
                <Pressable style={styles.actionButton} onPress={() => openUrl(video.url)}>
                  <Text style={styles.actionText}>打开</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => void copyUrl(video.id, video.url)}>
                  <Text style={styles.actionText}>{copiedId === video.id ? '已复制' : '复制链接'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  difficulty: {
    fontSize: 11,
    fontWeight: '800',
  },
  caption: {
    fontSize: 10,
    lineHeight: 15,
    color: Colors.text.muted,
  },
  emptyBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg.secondary,
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  searchButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: `${Colors.accent.secondary}22`,
    borderWidth: 1,
    borderColor: Colors.accent.secondary,
  },
  searchButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.secondary,
  },
  videoList: {
    gap: 8,
  },
  videoRow: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg.secondary,
    gap: 8,
  },
  videoInfo: {
    gap: 3,
  },
  videoKind: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  videoTitle: {
    fontSize: 12,
    color: Colors.text.primary,
  },
  uploader: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  videoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
});
