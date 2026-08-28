/**
 * 单曲查分分享卡片（v1.13.0）：曲绘 + 曲名/曲师 + 难度徽章 + 定数/完成率/Rating，
 * 通过 ViewShot 捕获为 PNG 分享。
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../constants';
import { CoverImage } from './CoverImage';
import { calculateRating, formatAchievement } from '../data/rating';
import { captureAndShare, shareCardFileName } from '../data/share-card';
import type { MusicData, PlayerScore } from '../data/types';

interface Props {
  music: MusicData;
  difficultyIndex: number;
  score?: PlayerScore;
  officialConstant?: number;
  /** 挂载分享触发器：把 capture 函数暴露给父级。 */
  onReady?: (capture: () => Promise<void>) => void;
}

export function SongShareCard({ music, difficultyIndex, score, officialConstant, onReady }: Props) {
  const viewShotRef = useRef<ViewShotRef>(null);
  const borderColor = DifficultyColorMap[difficultyIndex] || Colors.accent.secondary;

  useEffect(() => {
    onReady?.(async () => {
      await captureAndShare(viewShotRef.current, shareCardFileName('MaiMate-song'));
    });
    // 仅挂载时注册一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ds = officialConstant ?? music.ds[difficultyIndex];
  const rating = score && ds !== undefined && Number.isFinite(ds) ? calculateRating(ds, score.achievement) : null;

  return (
    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.host}>
      <View style={styles.card}>
        <View style={[styles.coverWrap, { borderColor }]}>
          <CoverImage music={music} style={styles.cover} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{music.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{music.basic_info.artist}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.diffChip, { borderColor, backgroundColor: `${borderColor}26` }]}>
              <Text style={[styles.diffChipText, { color: borderColor }]}>{DifficultyLabels[difficultyIndex] || `难度 ${difficultyIndex}`}</Text>
            </View>
            {ds !== undefined && Number.isFinite(ds) && <Text style={styles.meta}>定数 {ds.toFixed(1)}</Text>}
          </View>
          {score ? (
            <View style={styles.scoreRow}>
              <Text style={styles.achievement}>{formatAchievement(score.achievement)}</Text>
              {rating !== null && <Text style={styles.rating}>→ {rating}</Text>}
              {!!score.fc && <Text style={styles.badge}>{score.fc.toUpperCase()}</Text>}
              {!!score.fs && <Text style={styles.badge}>{score.fs.toUpperCase()}</Text>}
            </View>
          ) : (
            <Text style={styles.noScore}>尚未导入成绩</Text>
          )}
        </View>
        <Text style={styles.footer}>MaiMate · 舞萌DX 查分</Text>
      </View>
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: -9999, top: 0, opacity: 0 },
  card: {
    width: 340,
    flexDirection: 'row',
    backgroundColor: '#14142b',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  coverWrap: {
    width: 96, height: 96, borderWidth: 2.5, borderRadius: 10, overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '900', color: '#f0e6ff', lineHeight: 20 },
  artist: { fontSize: 10, color: '#9888b0' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diffChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  diffChipText: { fontSize: 9, fontWeight: '900' },
  meta: { fontSize: 10, color: '#00d4ff', fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  achievement: { fontSize: 17, fontWeight: '900', color: '#f0e6ff' },
  rating: { fontSize: 12, fontWeight: '800', color: '#ff6b9d' },
  badge: { fontSize: 8.5, fontWeight: '900', color: '#3dd68c', backgroundColor: 'rgba(61,214,140,0.14)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  noScore: { fontSize: 11, color: '#5a4a6e' },
  footer: { position: 'absolute', right: 12, bottom: 8, fontSize: 7.5, color: '#5a4a6e' },
});
