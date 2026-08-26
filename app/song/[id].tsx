/**
 * 歌曲详情页
 * 展示谱面信息、note分布、推分操作
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMusicStore, usePlanStore, useScoreStore, useSettingsStore } from '../../src/store';
import { BilibiliSearchPanel, CoverImage, DifficultyBadge, NoteBar, RatingPanel, AchievementLossCard } from '../../src/components';
import { Colors } from '../../src/constants';
import { DifficultyLabels, getChinaVersionName } from '../../src/constants/game';
import { getOfficialChartConstant, getTotalNotes } from '../../src/data/music-list';
import { formatAchievement, normalizeAchievement } from '../../src/data/rating';
import { openMusicPlatformSearch } from '../../src/data/external-links';
import { MUSIC_PLATFORM_LABELS } from '../../src/data/music-platforms';
import type { ChartData, MusicPlatform } from '../../src/data/types';

export default function SongDetail() {
  const { id, type, difficultyIndex, source } = useLocalSearchParams<{ id: string; type?: 'SD' | 'DX'; difficultyIndex?: string; source?: string }>();
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const chartStats = useMusicStore(s => s.chartStats);
  const chartStatsLoading = useMusicStore(s => s.chartStatsLoading);
  const scores = useScoreStore(s => s.scores);
  const settings = useSettingsStore(s => s.settings);
  const isInPlan = usePlanStore(s => s.isInPlan);
  const addEntry = usePlanStore(s => s.addEntry);
  const removeEntry = usePlanStore(s => s.removeEntry);
  const updateTargetScore = usePlanStore(s => s.updateTargetScore);
  const entries = usePlanStore(s => s.entries);

  const music = rawData.find(m => m.id === id && (!type || m.type === type)) || rawData.find(m => m.id === id);
  const sourceValue = Array.isArray(source) ? source[0] : source;
  const requestedDifficulty = Number(Array.isArray(difficultyIndex) ? difficultyIndex[0] : difficultyIndex);

  const [selectedDiff, setSelectedDiff] = useState(0);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [customTarget, setCustomTarget] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBack = useCallback(() => {
    if (sourceValue === 'plan') {
      router.replace('/plan');
    } else {
      router.back();
    }
  }, [router, sourceValue]);

  useEffect(() => {
    if (!music) return;
    const highestAvailable = Math.min(music.charts.length, music.level.length) - 1;
    const nextDifficulty = Number.isInteger(requestedDifficulty) && requestedDifficulty >= 0
      ? Math.min(requestedDifficulty, Math.max(0, highestAvailable))
      : Math.max(0, highestAvailable);
    setSelectedDiff(nextDifficulty);
  }, [music?.id, music?.type, music?.charts.length, music?.level.length, requestedDifficulty]);

  useEffect(() => {
    if (sourceValue !== 'plan') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack, sourceValue]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(null), 1800);
  }, []);

  const handleAddToPlan = useCallback(() => {
    if (!music) return;
    setPlanModalVisible(true);
  }, [music]);

  const handlePlanConfirm = useCallback(() => {
    if (!music) return;
    if (isInPlan(music.id, selectedDiff, music.type)) {
      removeEntry(music.id, selectedDiff, music.type);
      showToast('已从推分计划移除');
    } else {
      addEntry({
        songId: music.id,
        musicType: music.type,
        difficultyIndex: selectedDiff,
      });
      showToast('已添加到推分计划');
    }
    setPlanModalVisible(false);
  }, [music, selectedDiff, isInPlan, addEntry, removeEntry, showToast]);

  const targetEntry = music
    ? entries.find(entry => entry.songId === music.id && entry.difficultyIndex === selectedDiff && entry.musicType === music.type)
    : undefined;

  useEffect(() => {
    setCustomTarget(targetEntry?.targetScore === undefined ? '' : String(targetEntry.targetScore));
  }, [targetEntry?.targetScore, music?.id, selectedDiff]);

  if (!music) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>歌曲未找到</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const chart: ChartData | undefined = music.charts[selectedDiff];
  const ds = getOfficialChartConstant(music, selectedDiff) ?? undefined;
  const level = music.level[selectedDiff];
  const isDX = music.type === 'DX';
  const stats = chartStats[music.id]?.[selectedDiff] || undefined;
  const currentScore = scores.find(score =>
    score.songId === music.id && score.type === music.type && score.difficultyIndex === selectedDiff,
  );
  const inPlan = isInPlan(music.id, selectedDiff, music.type);
  const commitCustomTarget = () => {
    const normalized = customTarget.trim().replace(',', '.');
    if (!normalized) {
      updateTargetScore(music.id, selectedDiff, null, music.type);
      return;
    }
    const value = normalizeAchievement(Number(normalized));
    if (value === null) {
      showToast('目标需要是 0–100.5 之间的数字');
      return;
    }
    updateTargetScore(music.id, selectedDiff, Math.min(100.5, value), music.type);
    showToast(`已设置目标 ${Math.min(100.5, value)}`);
  };

  const openMusicPlatform = async (platform: MusicPlatform) => {
    try {
      const result = await openMusicPlatformSearch(platform, music.title, music.basic_info.artist, { appSearchFirst: settings.musicAppSearchFirst });
      showToast(result === 'app' ? `已打开${MUSIC_PLATFORM_LABELS[platform]}应用` : `已打开${MUSIC_PLATFORM_LABELS[platform]}网页`);
    } catch {
      showToast('无法打开音乐平台');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: music.title,
          headerStyle: { backgroundColor: Colors.bg.primary },
          headerTintColor: Colors.text.primary,
          headerTitleStyle: { fontWeight: '700' },
           headerLeft: sourceValue === 'plan'
             ? () => <Pressable onPress={handleBack} hitSlop={12}><Text style={styles.headerBack}>‹ 计划</Text></Pressable>
             : undefined,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* 歌曲基本信息 */}
        <View style={styles.heroCard}>
          <CoverImage music={music} allSongs={rawData} style={styles.heroCover} accessibilityLabel={`${music.title} 曲绘`} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{music.title}</Text>
            <Text style={styles.heroArtist}>{music.basic_info.artist}</Text>
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>{music.basic_info.genre}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.heroMetaText}>BPM {music.basic_info.bpm}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={[styles.heroMetaText, styles.typeTag, isDX && styles.typeDx]}>
                {music.type}
              </Text>
            </View>
            <Text style={styles.heroVersion}>原始版本：{music.basic_info.from}</Text>
            <Text style={styles.heroVersion}>国区版本：{getChinaVersionName(music.basic_info.from)}</Text>
          </View>
        </View>

        {/* 难度选择器 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>难度选择</Text>
          <View style={styles.diffRow}>
            {music.level.map((lv, i) => (
              <Pressable
                key={i}
                style={[styles.diffChip, selectedDiff === i && styles.diffChipActive]}
                onPress={() => setSelectedDiff(i)}
              >
                <DifficultyBadge
                  index={i}
                  level={lv}
                  ds={getOfficialChartConstant(music, i) ?? undefined}
                  size="lg"
                  highlighted={selectedDiff === i}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {inPlan && (
          <View style={styles.targetEditorCard}>
            <Text style={styles.targetEditorTitle}>推分目标</Text>
            <Text style={styles.targetEditorHint}>已设置目标后，计划列表只显示目标和目标 Rating；其他目标可在这里自定义。</Text>
            <View style={styles.targetPresetRow}>
              {[100, 100.5].map(target => (
                <Pressable key={target} style={[styles.detailTargetPreset, targetEntry?.targetScore === target && styles.detailTargetPresetActive]} onPress={() => { updateTargetScore(music.id, selectedDiff, targetEntry?.targetScore === target ? null : target, music.type); setCustomTarget(targetEntry?.targetScore === target ? '' : String(target)); }}>
                  <Text style={[styles.detailTargetText, targetEntry?.targetScore === target && styles.detailTargetTextActive]}>{target}</Text>
                </Pressable>
              ))}
              <TextInput style={styles.customTargetInput} value={customTarget} onChangeText={setCustomTarget} onEndEditing={commitCustomTarget} keyboardType="decimal-pad" placeholder="自定义，如 99.8" placeholderTextColor={Colors.text.muted} />
              <Pressable style={styles.customTargetButton} onPress={commitCustomTarget}><Text style={styles.customTargetButtonText}>保存</Text></Pressable>
            </View>
            {!!targetEntry?.targetScore && <Text style={styles.targetSavedText}>当前目标：{targetEntry.targetScore}</Text>}
          </View>
        )}

        {/* 谱面详情 */}
        {chart && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>谱面详情</Text>
              <View style={styles.chartCard}>
                {/* 定数与等级 */}
                <View style={styles.chartHeader}>
                  <View style={styles.chartHeaderInfo}>
                    <Text style={styles.chartLevel}>
                      {DifficultyLabels[selectedDiff]} {level}
                    </Text>
                    <Text style={styles.chartDs}>
                      {ds === undefined ? '官方定数: 无详细定数（宴会场或数据缺失）' : `官方定数: ${ds.toFixed(1)}`}
                    </Text>
                    <Text style={styles.chartDs}>
                      {stats ? `拟合定数: ${stats.fit_diff.toFixed(2)} · 样本 ${stats.cnt}` : chartStatsLoading ? '拟合定数加载中…' : '暂无拟合定数'}
                    </Text>
                  </View>
                  <View style={styles.totalNotes}>
                    <Text style={styles.totalNotesNum}>{getTotalNotes(chart)}</Text>
                    <Text style={styles.totalNotesLabel}>Total Notes</Text>
                  </View>
                </View>

                {/* Note 分布条 */}
                <View style={styles.noteSection}>
                  <Text style={styles.noteSectionTitle}>Note 分布</Text>
                  <NoteBar chart={chart} isDX={isDX} />
                </View>

                {/* Note 详细数据 */}
                <View style={styles.noteDetail}>
                  {(() => {
                    const labels = isDX
                      ? ['TAP', 'HOLD', 'SLIDE', 'TOUCH', 'BREAK']
                      : ['TAP', 'HOLD', 'SLIDE', 'BREAK'];
                    return chart.notes.map((count, i) => (
                      <View key={i} style={styles.noteItem}>
                        <Text style={styles.noteCount}>{count}</Text>
                        <Text style={styles.noteLabel}>{labels[i]}</Text>
                      </View>
                    ));
                  })()}
                </View>

                {/* 谱师 */}
                <View style={styles.charterRow}>
                  <Text style={styles.charterLabel}>谱师</Text>
                  <Text style={styles.charterValue}>{chart.charter || '-'}</Text>
                </View>

                <RatingPanel ds={ds} fitDiff={stats?.fit_diff} loading={chartStatsLoading} />
                {currentScore ? (
                  <View style={styles.importedScoreCard}>
                    <Text style={styles.importedScoreTitle}>已导入成绩</Text>
                    <Text style={styles.importedScoreValue}>{formatAchievement(currentScore.achievement)} · DX Score {currentScore.dxScore}</Text>
                    <Text style={styles.importedScoreMeta}>
                      {currentScore.fc ? `${currentScore.fc} ` : ''}{currentScore.fs ? `${currentScore.fs} ` : ''}
                      {currentScore.serverRating === undefined ? '' : `· 服务器 RA ${currentScore.serverRating}`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.importedScoreEmpty}>尚未导入该难度成绩</Text>
                )}
                {chart && <AchievementLossCard notes={chart.notes} />}
                <BilibiliSearchPanel
                  songId={music.id}
                   songTitle={music.title}
                   musicType={music.type}
                  difficultyIndex={selectedDiff}
                 />

                 <View style={styles.platformCard}>
                   <View style={styles.platformHeader}>
                     <Text style={styles.platformTitle}>音乐平台搜索</Text>
                     <Text style={styles.platformDefault}>默认：{MUSIC_PLATFORM_LABELS[settings.defaultMusicPlatform]}</Text>
                   </View>
                   <View style={styles.platformRow}>
                     {(Object.keys(MUSIC_PLATFORM_LABELS) as MusicPlatform[]).map(platform => (
                       <Pressable key={platform} style={[styles.platformButton, platform === settings.defaultMusicPlatform && styles.platformButtonActive]} onPress={() => void openMusicPlatform(platform)}>
                         <Text style={[styles.platformButtonText, platform === settings.defaultMusicPlatform && styles.platformButtonTextActive]}>{MUSIC_PLATFORM_LABELS[platform]}</Text>
                       </Pressable>
                     ))}
                   </View>
                   <Text style={styles.platformNote}>直接打开音乐平台的网页搜索结果页，可立即查看候选曲目；平台应用内的深链搜索由客户端路由决定，不做保证。</Text>
                 </View>
              </View>
            </View>

          </>
        )}

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, inPlan ? styles.actionBtnRemove : styles.actionBtnAdd]}
            onPress={handleAddToPlan}
          >
            <Text style={[styles.actionBtnText, inPlan && styles.actionBtnTextRemove]}>
              {inPlan ? '✓ 已在推分计划' : '📋 添加到推分计划'}
            </Text>
          </Pressable>
        </View>

        {/* 数据来源标注 */}
        <Text style={styles.attribution}>
          数据来源: Diving-Fish 舞萌DX查分器 (MIT)
        </Text>
      </ScrollView>

      <Modal
        transparent
        visible={planModalVisible}
        animationType="fade"
        onRequestClose={() => setPlanModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.planModalCard}>
            <Text style={styles.planModalTitle}>{inPlan ? '已在推分计划中' : '添加到推分计划'}</Text>
            <Text style={styles.planModalMessage}>
              {inPlan
                ? `要从计划中移除「${music.title}」的${DifficultyLabels[selectedDiff]}谱面吗？`
                : `将「${music.title}」的${DifficultyLabels[selectedDiff]}谱面加入推分计划？`}
            </Text>
            <View style={styles.planModalActions}>
              <Pressable style={styles.planCancelButton} onPress={() => setPlanModalVisible(false)}>
                <Text style={styles.planCancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.planConfirmButton, inPlan && styles.planRemoveButton]}
                onPress={handlePlanConfirm}
              >
                <Text style={styles.planConfirmText}>{inPlan ? '移除' : '添加'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    paddingBottom: 40,
  },
  notFound: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.text.muted,
  },
  backLink: {
    fontSize: 14,
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  // Hero card
  heroCard: {
    flexDirection: 'row',
    margin: 12,
    padding: 14,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  heroCover: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  heroArtist: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  heroMetaText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  dot: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  typeTag: {
    fontWeight: '600',
  },
  typeDx: {
    color: Colors.accent.secondary,
  },
  heroVersion: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  // Sections
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  // Difficulty selector
  diffRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  diffChip: {
    padding: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  diffChipActive: {
    borderColor: Colors.accent.primary,
  },
  // Chart card
  chartCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  // 左侧信息区约束宽度，避免长文案（如宴会场的“无详细定数”提示）把
  // 右侧 Total Notes 挤出卡片边界。
  chartHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  chartLevel: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  chartDs: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  importedScoreCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: `${Colors.functional.success}16`,
    borderWidth: 1,
    borderColor: `${Colors.functional.success}55`,
    gap: 3,
  },
  importedScoreTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.functional.success,
  },
  importedScoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  importedScoreMeta: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  importedScoreEmpty: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  totalNotes: {
    alignItems: 'center',
  },
  totalNotesNum: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  totalNotesLabel: {
    fontSize: 10,
    color: Colors.text.muted,
    textTransform: 'uppercase',
  },
  noteSection: {
    gap: 6,
  },
  noteSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  noteDetail: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 10,
    padding: 12,
  },
  noteItem: {
    alignItems: 'center',
    gap: 2,
  },
  noteCount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  noteLabel: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  charterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  charterLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  charterValue: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  headerBack: { fontSize: 15, fontWeight: '800', color: Colors.accent.primary },
  platformCard: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.bg.tertiary, gap: 8 },
  platformHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  platformTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  platformDefault: { fontSize: 10, color: Colors.text.muted },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  platformButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  platformButtonActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  platformButtonText: { fontSize: 10, color: Colors.text.secondary },
  platformButtonTextActive: { color: Colors.accent.primary, fontWeight: '800' },
  platformNote: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
  targetEditorCard: { marginTop: 14, marginHorizontal: 16, padding: 12, borderRadius: 12, backgroundColor: Colors.bg.secondary, gap: 7 },
  targetEditorTitle: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
  targetEditorHint: { fontSize: 10, lineHeight: 15, color: Colors.text.muted },
  targetPresetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  detailTargetPreset: { minWidth: 52, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center' },
  detailTargetPresetActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  detailTargetText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '700' },
  detailTargetTextActive: { color: Colors.accent.primary },
  customTargetInput: { flex: 1, minWidth: 100, height: 36, paddingHorizontal: 8, borderRadius: 7, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light, color: Colors.text.primary, fontSize: 11 },
  customTargetButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 7, backgroundColor: Colors.accent.secondary },
  customTargetButtonText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  targetSavedText: { fontSize: 10, color: Colors.accent.primary },
  // Actions
  actions: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnAdd: {
    backgroundColor: Colors.accent.primary,
  },
  actionBtnRemove: {
    backgroundColor: `${Colors.functional.danger}22`,
    borderWidth: 1,
    borderColor: Colors.functional.danger,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  actionBtnTextRemove: {
    color: Colors.functional.danger,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  planModalCard: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 18,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  planModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  planModalMessage: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  planModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  planCancelButton: {
    minWidth: 82,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
  },
  planCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  planConfirmButton: {
    minWidth: 82,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
  },
  planRemoveButton: {
    backgroundColor: Colors.functional.danger,
  },
  planConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 34,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(25, 25, 34, 0.94)',
  },
  toastText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  // Attribution
  attribution: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 24,
    paddingHorizontal: 16,
  },
});