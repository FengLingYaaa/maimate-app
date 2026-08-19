/**
 * 推分计划页
 * 展示用户标记的推分歌曲、选中难度、目标成绩与导入成绩。
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlanStore, useMusicStore, useScoreStore, useSettingsStore } from '../src/store';
import { SongCard } from '../src/components';
import { Colors, DifficultyLabels } from '../src/constants';
import { calculateRating, formatAchievement } from '../src/data/rating';
import { getOfficialChartConstant } from '../src/data/music-list';
import type { PlanEntry, MusicData, PlayerScore } from '../src/data/types';

export default function PushPlan() {
  const router = useRouter();
  const entries = usePlanStore(s => s.entries);
  const removeEntry = usePlanStore(s => s.removeEntry);
  const updateTargetScore = usePlanStore(s => s.updateTargetScore);
  const clearPlan = usePlanStore(s => s.clearPlan);
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const settings = useSettingsStore(s => s.settings);

  const plannedSongs = useMemo(() => {
    return entries
      .map(entry => {
        const music = rawData.find(m => m.id === entry.songId && (!entry.musicType || m.type === entry.musicType))
          || rawData.find(m => m.id === entry.songId);
        return music ? { music, entry } : null;
      })
      .filter((x): x is { music: MusicData; entry: PlanEntry } => x !== null);
  }, [entries, rawData]);

  const handleRemove = useCallback((songId: string, diffIdx: number, musicType: 'SD' | 'DX') => {
    Alert.alert('移出计划', '确定要从推分计划中移除此歌曲吗？', [
      { text: '取消', style: 'cancel' },
      { text: '移除', style: 'destructive', onPress: () => removeEntry(songId, diffIdx, musicType) },
    ]);
  }, [removeEntry]);

  const handleClear = useCallback(() => {
    Alert.alert('清空计划', '确定要清空整个推分计划吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: clearPlan },
    ]);
  }, [clearPlan]);

  const getScore = useCallback((music: MusicData, entry: PlanEntry): PlayerScore | undefined => {
    return scores.find(score =>
      score.songId === music.id
      && score.difficultyIndex === entry.difficultyIndex
      && (!entry.musicType || score.type === entry.musicType)
      && score.type === music.type,
    );
  }, [scores]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📋 推分计划</Text>
          {entries.length > 0 && (
            <Pressable onPress={handleClear}>
              <Text style={styles.clearBtn}>清空</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.headerSub}>
          {entries.length > 0 ? `${entries.length} 首待练习` : '还没有添加歌曲'} · 每张卡只展示计划难度
        </Text>
      </View>

      {plannedSongs.length > 0 ? (
        <FlatList
          data={plannedSongs}
          keyExtractor={item => `${item.music.id}-${item.music.type}-${item.entry.difficultyIndex}`}
          renderItem={({ item, index }) => {
            const { music, entry } = item;
            const officialConstant = getOfficialChartConstant(music, entry.difficultyIndex);
            const targetRating = entry.targetScore === undefined
              ? null
              : calculateRating(officialConstant ?? undefined, entry.targetScore);
            const importedScore = getScore(music, entry);
            return (
              <View style={styles.cardWrapper}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderText}>{index + 1}</Text>
                </View>
                <View style={styles.cardWithAction}>
                  <View style={styles.cardFlex}>
                    <SongCard
                      music={music}
                      selectedDifficultyIndex={entry.difficultyIndex}
                      showChinaVersion={settings.showChinaVersion}
                      allSongs={rawData}
                       onPress={() => router.push({ pathname: '/song/[id]' as any, params: { id: music.id, type: music.type, difficultyIndex: String(entry.difficultyIndex), source: 'plan' } })}
                    />
                    <View style={styles.detailBox}>
                      <Text style={styles.detailTitle}>
                        {DifficultyLabels[entry.difficultyIndex] || `难度 ${entry.difficultyIndex}`}
                        {' · '}
                        {officialConstant === null ? '无详细定数' : `官方定数 ${officialConstant.toFixed(1)}`}
                      </Text>
                      {officialConstant === null && <Text style={styles.warningText}>宴会場或数据缺失：不计算官方目标 Rating；拟合值也仅作参考。</Text>}
                      <View style={styles.targetRow}>
                        <Text style={styles.targetLabel}>目标达成率</Text>
                        {[100, 100.5].map(target => (
                           <Pressable
                             key={target}
                             style={[styles.targetPreset, entry.targetScore === target && styles.targetPresetActive]}
                             onPress={() => updateTargetScore(music.id, entry.difficultyIndex, entry.targetScore === target ? null : target, music.type)}
                           >
                             <Text style={[styles.targetPresetText, entry.targetScore === target && styles.targetPresetTextActive]}>{target}</Text>
                           </Pressable>
                         ))}
                         {entry.targetScore !== undefined && <Text style={styles.targetCurrent}>当前 {entry.targetScore}</Text>}
                        {settings.showProjectedRating && <Text style={styles.projectedRating}>目标 Rating：{targetRating ?? '—'}</Text>}
                      </View>
                      {importedScore ? (
                        <Text style={styles.scoreText}>
                          当前成绩：{formatAchievement(importedScore.achievement)} · DX {importedScore.dxScore}
                          {importedScore.fc ? ` · ${importedScore.fc}` : ''}{importedScore.fs ? ` · ${importedScore.fs}` : ''}
                          {importedScore.serverRating === undefined ? '' : ` · RA ${importedScore.serverRating}`}
                        </Text>
                      ) : (
                        <Text style={styles.scoreMuted}>当前成绩：尚未导入或没有匹配的成绩</Text>
                      )}
                    </View>
                  </View>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => handleRemove(music.id, entry.difficultyIndex, music.type)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                </View>
                {entry.note && <Text style={styles.noteText}>💬 {entry.note}</Text>}
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>暂未添加推分歌曲</Text>
          <Text style={styles.emptySub}>在曲库中打开歌曲详情，选择难度后加入推分计划</Text>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  headerSub: { fontSize: 12, lineHeight: 18, color: Colors.text.muted, marginTop: 2 },
  clearBtn: { fontSize: 14, color: Colors.functional.danger, fontWeight: '600' },
  cardWrapper: { paddingHorizontal: 12, paddingVertical: 5 },
  orderBadge: { position: 'absolute', top: 13, left: 8, zIndex: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  cardWithAction: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  cardFlex: { flex: 1 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 16, color: Colors.functional.danger, fontWeight: '700' },
  detailBox: { marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: Colors.bg.tertiary, gap: 5 },
  detailTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  warningText: { fontSize: 10, lineHeight: 15, color: Colors.functional.warning },
  targetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  targetLabel: { fontSize: 11, color: Colors.text.secondary },
  targetPreset: { minWidth: 46, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 7, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center' },
  targetPresetActive: { backgroundColor: `${Colors.accent.primary}22`, borderColor: Colors.accent.primary },
  targetPresetText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '700' },
  targetPresetTextActive: { color: Colors.accent.primary },
  targetCurrent: { fontSize: 10, color: Colors.text.muted },
  projectedRating: { fontSize: 11, color: Colors.accent.primary, fontWeight: '700' },
  scoreText: { fontSize: 11, lineHeight: 16, color: Colors.functional.success },
  scoreMuted: { fontSize: 11, color: Colors.text.muted },
  noteText: { fontSize: 12, color: Colors.text.secondary, marginTop: 2, paddingLeft: 40 },
  listContent: { paddingTop: 4, paddingBottom: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyIcon: { fontSize: 64 },
  emptyText: { fontSize: 16, color: Colors.text.muted, fontWeight: '600' },
  emptySub: { fontSize: 13, color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 24 },
});
