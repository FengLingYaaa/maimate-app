/**
 * v1.19.0「目标 Rating」：距下一档 Rating 还差多少、推荐哪些谱面（入口：B50 页卡片、推分计划页顶部按钮）。
 * 数据：src/data/next-rating-target.ts（rating.ts 段位表 + achievement-loss 容错 + computeB50Gain 精确增益）。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../src/constants';
import { computeRatingTarget, type RatingTargetCandidate } from '../src/data/next-rating-target';
import { formatAchievement } from '../src/data/rating';
import { useMusicStore, usePlanStore, useScoreStore } from '../src/store';
import { RatingTargetRow } from '../src/components/RatingTargetRow';

export default function RatingTargetScreen() {
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const entries = usePlanStore(s => s.entries);
  const isInPlan = usePlanStore(s => s.isInPlan);
  const addEntry = usePlanStore(s => s.addEntry);
  const updateTargetScore = usePlanStore(s => s.updateTargetScore);
  const [notice, setNotice] = useState<string | null>(null);

  const result = useMemo(
    () => (scores.length > 0 && rawData.length > 0 ? computeRatingTarget(rawData, scores, { isInPlan }) : null),
    // entries 变化时重新标注「已在计划」。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawData, scores, entries],
  );

  const addToPlan = (candidate: RatingTargetCandidate) => {
    if (isInPlan(candidate.songId, candidate.difficultyIndex, candidate.musicType)) {
      setNotice(`「${candidate.title}」已在推分计划里`);
      return;
    }
    addEntry({ songId: candidate.songId, musicType: candidate.musicType, difficultyIndex: candidate.difficultyIndex });
    updateTargetScore(candidate.songId, candidate.difficultyIndex, candidate.targetAchievement, candidate.musicType);
    setNotice(`已加入推分计划：${candidate.title}（目标 ${formatAchievement(candidate.targetAchievement)}）`);
  };

  const addPlanned = () => {
    if (!result) return;
    let added = 0;
    for (const key of result.plannedKeys) {
      const candidate = result.candidates.find(item => item.key === key);
      if (!candidate || isInPlan(candidate.songId, candidate.difficultyIndex, candidate.musicType)) continue;
      addEntry({ songId: candidate.songId, musicType: candidate.musicType, difficultyIndex: candidate.difficultyIndex });
      updateTargetScore(candidate.songId, candidate.difficultyIndex, candidate.targetAchievement, candidate.musicType);
      added += 1;
    }
    setNotice(added > 0 ? `已把 ${added} 张推荐谱面加入推分计划` : '推荐组合里的谱面都已在计划中');
  };

  const openSong = (candidate: RatingTargetCandidate) => router.push({
    pathname: '/song/[id]' as any,
    params: { id: candidate.songId, type: candidate.musicType, difficultyIndex: String(candidate.difficultyIndex) },
  });

  if (!result) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{scores.length === 0 ? '先在设置里同步成绩，才能计算距下一档还差什么。' : '曲库加载中…'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headline}>
        <Text style={styles.headlineLabel}>当前 B50 {result.current} · 下一档 {result.targetLabel}</Text>
        <Text style={styles.headlineValue}>{result.gap === 0 ? '已达到目标' : `还差 ${result.gap}`}</Text>
        {result.gap > 0 && (
          <Text style={styles.headlineSub}>
            {result.minCharts !== null
              ? `按推荐顺序，最少 ${result.minCharts} 张谱面达到目标即可`
              : result.candidates.length > 0 ? '前 10 张推荐都达到也还不够，可以多推几张' : '当前定数范围内没有找到能涨分的谱面'}
          </Text>
        )}
        {result.minCharts !== null && result.minCharts > 0 && (
          <Pressable style={styles.bulkButton} onPress={addPlanned}>
            <Text style={styles.bulkText}>把这 {result.minCharts} 张加入推分计划</Text>
          </Pressable>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </View>
      <Text style={styles.sectionTitle}>推荐谱面（按 B50 增益 → 定数接近 → 提升幅度小 排序）</Text>
      {result.candidates.map(candidate => (
        <RatingTargetRow key={candidate.key} candidate={candidate} onAdd={addToPlan} onOpen={openSong} />
      ))}
      <Text style={styles.note}>增益为单独完成该谱面后 B50 总分的变化（与推分计划卡片同口径）；已 100.5% 的谱面不会出现，每张谱面只推荐能涨分的最低一档。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 8, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center' },
  headline: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  headlineLabel: { fontSize: 12, color: Colors.text.secondary },
  headlineValue: { fontSize: 24, fontWeight: '900', color: Colors.accent.primary },
  headlineSub: { fontSize: 11, color: Colors.text.secondary },
  bulkButton: { marginTop: 6, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.accent.primary },
  bulkText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  notice: { fontSize: 11, color: Colors.accent.secondary },
  sectionTitle: { marginTop: 6, fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  note: { marginTop: 6, fontSize: 10, color: Colors.text.muted, lineHeight: 15 },
});
