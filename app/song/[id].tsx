/**
 * 歌曲详情页
 * 展示谱面信息、note分布、推分操作
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMusicStore, usePlanStore } from '../../src/store';
import { ChartVideoPanel, DifficultyBadge, NoteBar, RatingPanel } from '../../src/components';
import { Colors } from '../../src/constants';
import { DifficultyLabels, getCoverUrl } from '../../src/constants/game';
import { getTotalNotes } from '../../src/data/music-list';
import type { ChartData } from '../../src/data/types';

export default function SongDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const chartStats = useMusicStore(s => s.chartStats);
  const chartStatsLoading = useMusicStore(s => s.chartStatsLoading);
  const isInPlan = usePlanStore(s => s.isInPlan);
  const addEntry = usePlanStore(s => s.addEntry);
  const removeEntry = usePlanStore(s => s.removeEntry);

  const music = rawData.find(m => m.id === id);

  const [selectedDiff, setSelectedDiff] = useState(0);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!music) return;
    const highestAvailable = Math.min(music.charts.length, music.ds.length, music.level.length) - 1;
    setSelectedDiff(Math.max(0, highestAvailable));
  }, [music?.id, music?.charts.length, music?.ds.length, music?.level.length]);

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
    if (isInPlan(music.id, selectedDiff)) {
      removeEntry(music.id, selectedDiff);
      showToast('已从推分计划移除');
    } else {
      addEntry({
        songId: music.id,
        difficultyIndex: selectedDiff,
      });
      showToast('已添加到推分计划');
    }
    setPlanModalVisible(false);
  }, [music, selectedDiff, isInPlan, addEntry, removeEntry, showToast]);

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
  const ds = music.ds[selectedDiff];
  const level = music.level[selectedDiff];
  const isDX = music.type === 'DX';
  const stats = chartStats[music.id]?.[selectedDiff] || undefined;
  const inPlan = isInPlan(music.id, selectedDiff);

  return (
    <>
      <Stack.Screen
        options={{
          title: music.title,
          headerStyle: { backgroundColor: Colors.bg.primary },
          headerTintColor: Colors.text.primary,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* 歌曲基本信息 */}
        <View style={styles.heroCard}>
          <Image
            source={{ uri: getCoverUrl(music.id) }}
            style={styles.heroCover}
            defaultSource={require('../../assets/icon.png')}
          />
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
            <Text style={styles.heroVersion}>{music.basic_info.from}</Text>
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
                  ds={music.ds[i]}
                  size="lg"
                  highlighted={selectedDiff === i}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* 谱面详情 */}
        {chart && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>谱面详情</Text>
              <View style={styles.chartCard}>
                {/* 定数与等级 */}
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartLevel}>
                      {DifficultyLabels[selectedDiff]} {level}
                    </Text>
                    <Text style={styles.chartDs}>官方定数: {ds}</Text>
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
                <ChartVideoPanel
                  songId={music.id}
                  songTitle={music.title}
                  difficultyIndex={selectedDiff}
                />
              </View>
            </View>

            {/* 各难度 Note 总览 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>全难度比较</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.compareRow}>
                  {music.charts
                    .map((c, i) => ({ chart: c, index: i }))
                    .filter(({ index }) => index !== selectedDiff)
                    .map(({ chart: c, index: i }) => (
                    <Pressable
                      key={i}
                      style={[styles.compareCard, selectedDiff === i && styles.compareCardActive]}
                      onPress={() => setSelectedDiff(i)}
                    >
                      <Text style={[styles.compareDiff, { color: Colors.difficulty[['basic', 'advanced', 'expert', 'master', 'remaster'][i] as keyof typeof Colors.difficulty] }]}>
                        {DifficultyLabels[i]}
                      </Text>
                      <Text style={styles.compareDs}>定数 {music.ds[i]}</Text>
                      <Text style={styles.compareNotes}>
                        {getTotalNotes(c)} notes
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
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
  // Compare cards
  compareRow: {
    gap: 10,
    flexDirection: 'row',
  },
  compareCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  compareCardActive: {
    borderColor: Colors.accent.primary,
  },
  compareDiff: {
    fontSize: 12,
    fontWeight: '700',
  },
  compareDs: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  compareNotes: {
    fontSize: 11,
    color: Colors.text.muted,
  },
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