import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicStore } from '../../src/store';
import { CoverImage } from '../../src/components';
import { Colors, DifficultyLabels, getChinaVersionName } from '../../src/constants';
import { generateFortune, getChinaDateKey, getFortuneSeed, type FortuneResult } from '../../src/data/fortune';
import { getOfficialChartConstant } from '../../src/data/music-list';
import type { MusicData } from '../../src/data/types';

export default function FortunePage() {
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const [seed, setSeed] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(getChinaDateKey());

  useEffect(() => {
    let active = true;
    void getFortuneSeed().then(value => {
      if (active) setSeed(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDateKey(getChinaDateKey()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const result: FortuneResult | null = useMemo(
    () => (seed ? generateFortune(seed, rawData, dateKey) : null),
    [seed, rawData, dateKey],
  );
  const recommendedSong = useMemo(
    () => result?.recommendedSongId
      ? rawData.find(song => song.id === result.recommendedSongId && song.type === result.recommendedMusicType)
        || rawData.find(song => song.id === result.recommendedSongId)
      : undefined,
    [result?.recommendedSongId, result?.recommendedMusicType, rawData],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🔮 今日舞萌运势</Text>
      <Text style={styles.subtitle}>{dateKey} · 每日结果稳定，娱乐功能仅供参考</Text>

      {!result ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>正在生成今日运势…</Text>
        </View>
      ) : (
        <>
          <View style={styles.luckCard}>
            <Text style={styles.luckCaption}>今日人品值</Text>
            <Text style={styles.luckValue}>{result.luck}</Text>
            <Text style={styles.luckHint}>{getLuckHint(result.luck)}</Text>
          </View>

          <View style={styles.twoColumns}>
            <FortuneList title="宜" values={result.should} color={Colors.functional.success} empty="保持平常心" />
            <FortuneList title="忌" values={result.avoid} color={Colors.functional.warning} empty="今日无忌" />
          </View>

          {recommendedSong && (
            <View style={styles.songCard}>
              <Text style={styles.sectionTitle}>今日推荐歌曲</Text>
               <CoverImage music={recommendedSong} allSongs={rawData} style={styles.songCover} accessibilityLabel={`${recommendedSong.title} 曲绘`} />
              <Text style={styles.songTitle} numberOfLines={2}>{recommendedSong.title}</Text>
              <Text style={styles.songMeta}>{recommendedSong.basic_info.artist} · {recommendedSong.type}</Text>
              <Text style={styles.songVersion} numberOfLines={2}>
                原始：{recommendedSong.basic_info.from} · 国区：{getChinaVersionName(recommendedSong.basic_info.from)}
              </Text>
              <View style={styles.songLevels}>
                {recommendedSong.level.map((level, index) => {
                  const constant = getOfficialChartConstant(recommendedSong, index);
                  return (
                    <Text key={index} style={styles.levelText}>
                      {DifficultyLabels[index]} {level}{constant === null ? '' : ` · ${constant.toFixed(1)}`}
                    </Text>
                  );
                })}
              </View>
              <Pressable style={styles.openButton} onPress={() => router.push({ pathname: '/song/[id]' as any, params: { id: recommendedSong.id, type: recommendedSong.type, source: 'fortune' } })}>
                <Text style={styles.openButtonText}>查看歌曲详情</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.note}>
            今日运势由本地种子和中国区日期生成，不读取成绩 Token，也不会上传运势数据。推荐按稳定的歌曲 ID、类型和标题排序生成；曲库内容发生变化时仍可能改变候选集。
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function getLuckHint(luck: number): string {
  if (luck >= 90) return '手感爆棚，适合挑战目标！';
  if (luck >= 70) return '状态不错，稳步推分！';
  if (luck >= 40) return '正常发挥，量力而行。';
  return '放松心情，先从熟悉的歌开始。';
}

function FortuneList({ title, values, color, empty }: { title: string; values: string[]; color: string; empty: string }) {
  return (
    <View style={styles.listCard}>
      <Text style={[styles.listTitle, { color }]}>{title}</Text>
      {values.length > 0 ? values.map(value => <Text key={value} style={styles.listValue}>· {value}</Text>) : <Text style={styles.listEmpty}>{empty}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingTop: 48, paddingBottom: 90, gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted },
  loadingCard: { padding: 20, borderRadius: 16, backgroundColor: Colors.bg.secondary },
  loadingText: { color: Colors.text.secondary },
  luckCard: { alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.accent },
  luckCaption: { fontSize: 13, color: Colors.text.secondary },
  luckValue: { marginTop: 2, fontSize: 58, lineHeight: 66, fontWeight: '900', color: Colors.accent.primary },
  luckHint: { fontSize: 12, color: Colors.text.muted },
  twoColumns: { flexDirection: 'row', gap: 10 },
  listCard: { flex: 1, minHeight: 118, padding: 12, borderRadius: 14, backgroundColor: Colors.bg.secondary },
  listTitle: { fontSize: 18, fontWeight: '900', marginBottom: 6 },
  listValue: { fontSize: 12, lineHeight: 20, color: Colors.text.primary },
  listEmpty: { fontSize: 12, color: Colors.text.muted },
  songCard: { padding: 14, borderRadius: 16, backgroundColor: Colors.bg.tertiary, gap: 5 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
   songCover: { width: '100%', height: 180, borderRadius: 12, marginTop: 4, backgroundColor: Colors.bg.secondary },
  songTitle: { fontSize: 18, fontWeight: '800', color: Colors.accent.secondary },
  songMeta: { fontSize: 12, color: Colors.text.secondary },
  songVersion: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
  songLevels: { gap: 2, marginTop: 5 },
  levelText: { fontSize: 11, color: Colors.text.secondary },
  openButton: { alignItems: 'center', marginTop: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: `${Colors.accent.primary}22`, borderWidth: 1, borderColor: Colors.accent.primary },
  openButtonText: { fontSize: 12, fontWeight: '800', color: Colors.accent.primary },
  note: { fontSize: 11, lineHeight: 17, color: Colors.text.muted },
});
