/** 推分计划：计划专属筛选、置顶分组拖拽、推歌英灵殿和自定义移除控件。 */

import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FilterBar, PlanDragList, PlanProgressRing, type PlanDragRow } from '../../src/components';
import { Colors, DifficultyColorMap, DifficultyLabels } from '../../src/constants';
import { getChinaVersionOptions, getVersionOptions } from '../../src/data/version-catalog';
import { getMusicSearchScore, getOfficialChartConstant, matchesMusic } from '../../src/data/music-list';
import { canDragPlanRows } from '../../src/data/plan-order';
import type { FilterOptions, MusicData, PlanEntry, PlayerScore, SortOptions } from '../../src/data/types';
import { useMusicStore, usePlanStore, useScoreStore, useSettingsStore } from '../../src/store';
import { planEntryKey } from '../../src/store/plan-store';

type PlanRow = PlanDragRow;

interface ConfirmRequest {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
}

function requestedDifficultyMatches(entry: PlanEntry, difficulty: FilterOptions['difficulty']): boolean {
  if (difficulty === undefined) return true;
  return (Array.isArray(difficulty) ? difficulty : [difficulty]).includes(entry.difficultyIndex);
}

function matchesPlanRow(row: PlanRow, filters: FilterOptions): boolean {
  if (!requestedDifficultyMatches(row.entry, filters.difficulty)) return false;
  return matchesMusic(row.music, { ...filters, difficulty: row.entry.difficultyIndex });
}

function sortPlanRows(rows: PlanRow[], sort: SortOptions | undefined, query?: string): PlanRow[] {
  const mode = sort?.mode;
  if (!mode || mode === 'relevance') {
    if (!query?.trim()) return rows;
    return rows.sort((left, right) => (getMusicSearchScore(right.music, query) ?? -1) - (getMusicSearchScore(left.music, query) ?? -1));
  }
  if (mode === 'titleAsc' || mode === 'titleDesc') {
    const descending = mode === 'titleDesc';
    return rows.sort((left, right) => {
      const result = left.music.title.localeCompare(right.music.title);
      return descending ? -result : result;
    });
  }
  const difficultyIndex = sort?.difficultyIndex ?? 3;
  const descending = mode === 'constantDesc';
  return rows.sort((left, right) => {
    const a = getOfficialChartConstant(left.music, difficultyIndex) ?? -1;
    const b = getOfficialChartConstant(right.music, difficultyIndex) ?? -1;
    return descending ? b - a : a - b;
  });
}

export default function PushPlan() {
  const router = useRouter();
  const entries = usePlanStore(s => s.entries);
  const graveyard = usePlanStore(s => s.graveyard);
  const removeEntryById = usePlanStore(s => s.removeEntryById);
  const updateTargetScoreById = usePlanStore(s => s.updateTargetScoreById);
  const bulkRemoveEntries = usePlanStore(s => s.bulkRemoveEntries);
  const purgeGraveyardEntry = usePlanStore(s => s.purgeGraveyardEntry);
  const restoreGraveyardEntry = usePlanStore(s => s.restoreGraveyardEntry);
  const reorderByIds = usePlanStore(s => s.reorderByIds);
  const clearAchievedTargets = usePlanStore(s => s.clearAchievedTargets);
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const settings = useSettingsStore(s => s.settings);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [graveyardVisible, setGraveyardVisible] = useState(false);
  const plannedRows = useMemo(() => entries
    .map(entry => {
      const music = rawData.find(item => item.id === entry.songId && (!entry.musicType || item.type === entry.musicType)) || rawData.find(item => item.id === entry.songId);
      return music ? { music, entry } : null;
    })
    .filter((item): item is PlanRow => item !== null)
    .sort((left, right) => left.entry.order - right.entry.order), [entries, rawData]);

  const filteredRows = useMemo(() => {
    const rows = plannedRows.filter(row => matchesPlanRow(row, filters));
    return sortPlanRows(rows, filters.sort, filters.titleSearch);
  }, [plannedRows, filters]);
  const manualOrderView = canDragPlanRows(filters);

  const genres = useMemo(() => [...new Set(plannedRows.map(row => row.music.basic_info.genre))].sort(), [plannedRows]);
  const versionOptions = useMemo(() => getVersionOptions(plannedRows.map(row => row.music)), [plannedRows]);
  const chinaVersionOptions = useMemo(() => getChinaVersionOptions(plannedRows.map(row => row.music)), [plannedRows]);
  const artists = useMemo(() => [...new Set(plannedRows.map(row => row.music.basic_info.artist))].sort(), [plannedRows]);
  const charters = useMemo(() => [...new Set(plannedRows.flatMap(row => row.music.charts.map(chart => chart.charter).filter(value => value && value !== '-')))].sort(), [plannedRows]);

  const getPreviewCount = useCallback((nextFilters: FilterOptions) => plannedRows.filter(row => matchesPlanRow(row, nextFilters)).length, [plannedRows]);
  const getScore = useCallback((music: MusicData, entry: PlanEntry): PlayerScore | undefined => scores.find(score => score.songId === music.id && score.difficultyIndex === entry.difficultyIndex && score.type === music.type), [scores]);

  // 移除走自定义确认控件（不再使用系统 Alert），移除后曲目进入「推歌英灵殿」。
  const handleRemove = useCallback((row: PlanRow) => {
    setConfirmRequest({
      title: '移出计划',
      message: `把《${row.music.title}》移出推分计划？\n移除后会进入下方「推歌英灵殿」，可在那里复原或彻底删除。`,
      confirmText: '移除',
      onConfirm: () => removeEntryById(row.entry.entryId),
    });
  }, [removeEntryById]);

  const handleClear = useCallback(() => {
    if (entries.length === 0) return;
    setConfirmRequest({
      title: '清空计划',
      message: `把全部 ${entries.length} 首待练习曲目移入推歌英灵殿？之后可在英灵殿中复原或彻底删除。`,
      confirmText: '清空',
      onConfirm: () => bulkRemoveEntries(entries.map(planEntryKey)),
    });
  }, [bulkRemoveEntries, entries]);

  const graveyardRows = useMemo(() => graveyard.map(item => ({
    ...item,
    music: rawData.find(m => m.id === item.entry.songId && (!item.entry.musicType || m.type === item.entry.musicType)) || rawData.find(m => m.id === item.entry.songId),
  })), [graveyard, rawData]);

  // v1.12.0：已达标条目（当前达成率 ≥ 目标），用于「清除已达标目标」按钮。
  const achievedEntryIds = useMemo(() => plannedRows
    .filter(row => row.entry.targetScore !== undefined)
    .filter(row => {
      const score = scores.find(item => item.songId === row.music.id
        && item.type === row.music.type
        && item.difficultyIndex === row.entry.difficultyIndex);
      return score ? score.achievement >= row.entry.targetScore! : false;
    })
    .map(row => row.entry.entryId), [plannedRows, scores]);

  const handleClearAchieved = useCallback(() => {
    if (achievedEntryIds.length === 0) return;
    setConfirmRequest({
      title: '清除已达标目标',
      message: `${achievedEntryIds.length} 个条目已达成目标。清除它们的目标分数？曲目保留在计划中。`,
      confirmText: '清除',
      onConfirm: () => clearAchievedTargets(achievedEntryIds),
    });
  }, [achievedEntryIds, clearAchievedTargets]);

  // v1.14.0：进度环改为「达标 x/y」主文案；平均完成率向下取整（不再四舍五入虚报 100%）。
  const progressSummary = useMemo(() => {
    const withTarget = plannedRows.filter(row => row.entry.targetScore !== undefined);
    const achievedSet = new Set(achievedEntryIds);
    let percentSum = 0;
    for (const row of withTarget) {
      const score = scores.find(item => item.songId === row.music.id
        && item.type === row.music.type
        && item.difficultyIndex === row.entry.difficultyIndex);
      const current = score?.achievement ?? 0;
      const target = row.entry.targetScore!;
      percentSum += target <= current ? 100 : Math.min(100, (current / target) * 100);
    }
    const achieved = withTarget.filter(row => achievedSet.has(row.entry.entryId)).length;
    const rawAverage = withTarget.length > 0 ? percentSum / withTarget.length : 0;
    return {
      achieved,
      withTargetCount: withTarget.length,
      noTargetCount: plannedRows.length - withTarget.length,
      /** 平均完成率，向下取整保留一位小数（99.67 → 99.6，永不显示 100 除非真达标）。 */
      averagePercent: Math.floor(rawAverage * 10) / 10,
      allAchieved: withTarget.length > 0 && achieved === withTarget.length,
    };
  }, [plannedRows, scores, achievedEntryIds]);

  const [achieveFilter, setAchieveFilter] = useState<'all' | 'achieved' | 'unachieved'>('all');
  // v1.15.1：按用户要求移除「缺口优先」排序切换，恢复 v1.14 手动拖拽序布局。

  const displayRows = useMemo(() => {
    if (achieveFilter === 'all') return filteredRows;
    const achievedSet = new Set(achievedEntryIds);
    return filteredRows.filter(row => {
      if (row.entry.targetScore === undefined) return achieveFilter === 'unachieved';
      const achieved = achievedSet.has(row.entry.entryId);
      return achieveFilter === 'achieved' ? achieved : !achieved;
    });
  }, [filteredRows, achieveFilter, achievedEntryIds]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📋 推分计划</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setGraveyardVisible(true)} style={styles.graveyardButton} accessibilityLabel="打开推歌英灵殿">
              <Text style={styles.graveyardIcon}>🗑️</Text>
              {graveyard.length > 0 && <View style={styles.graveyardBadge}><Text style={styles.graveyardBadgeText}>{graveyard.length}</Text></View>}
            </Pressable>
            {achievedEntryIds.length > 0 && <Pressable onPress={handleClearAchieved}><Text style={styles.clearBtn}>清已达</Text></Pressable>}
            {entries.length > 0 && <Pressable onPress={handleClear}><Text style={styles.clearBtn}>清空</Text></Pressable>}
          </View>
        </View>
        <Text style={styles.headerSub}>{entries.length > 0 ? `${entries.length} 首待练习` : '还没有添加歌曲'} · 长按曲目拖拽排序</Text>
        {progressSummary.withTargetCount > 0 && (
          <View style={styles.progressSummaryRow}>
            <PlanProgressRing
              achieved={progressSummary.achieved}
              total={progressSummary.withTargetCount}
              averagePercent={progressSummary.averagePercent}
              allAchieved={progressSummary.allAchieved}
            />
            <View style={styles.progressSummaryInfo}>
              <Text style={styles.progressSummaryTitle}>
                已达标 {progressSummary.achieved} / {progressSummary.withTargetCount}
              </Text>
              <Text style={styles.progressSummaryText}>
                平均完成 {progressSummary.averagePercent}% · 未设目标 {progressSummary.noTargetCount}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.b50Row}>
          {progressSummary.withTargetCount > 0 && (
            <View style={styles.achieveFilterRow}>
              {([['all', '全部'], ['achieved', '已达标'], ['unachieved', '未达标']] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[styles.achieveChip, achieveFilter === value && styles.achieveChipActive]}
                  onPress={() => setAchieveFilter(value)}
                >
                  <Text style={[styles.achieveChipText, achieveFilter === value && styles.achieveChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
      <FilterBar
        filters={filters}
        onApply={setFilters}
        onClear={() => setFilters({})}
        totalCount={plannedRows.length}
        filteredCount={displayRows.length}
        getPreviewCount={getPreviewCount}
        genres={genres}
        versionOptions={versionOptions}
        chinaVersionOptions={chinaVersionOptions}
        artists={artists}
        charters={charters}
      />
      {plannedRows.length === 0 ? (
        <EmptyPlan />
      ) : displayRows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{achieveFilter === 'all' ? '没有匹配的计划条目' : (achieveFilter === 'achieved' ? '还没有已达标条目' : '全部条目都已达标')}</Text>
          <Pressable onPress={() => { setFilters({}); setAchieveFilter('all'); }}><Text style={styles.clearLink}>清除全部筛选</Text></Pressable>
        </View>
      ) : (
        <PlanDragList
          rows={displayRows}
          canDrag={manualOrderView && achieveFilter === 'all'}
          showChinaVersion={settings.showChinaVersion}
          showProjectedRating={settings.showProjectedRating}
          allSongs={rawData}
          allScores={scores}
          getScore={getScore}
          onOpen={row => router.push({ pathname: '/song/[id]' as any, params: { id: row.music.id, type: row.music.type, difficultyIndex: String(row.entry.difficultyIndex), source: 'plan' } })}
          onRemove={entryId => {
            const row = displayRows.find(item => item.entry.entryId === entryId);
            if (row) handleRemove(row);
          }}
          onTarget={updateTargetScoreById}
          onReorder={reorderByIds}
        />
      )}

      {/* 推歌英灵殿 */}
      <Modal visible={graveyardVisible} transparent animationType="slide" onRequestClose={() => setGraveyardVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setGraveyardVisible(false)}>
          <Pressable style={styles.sheetCard} onPress={event => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>🗑️ 推歌英灵殿</Text>
              <Pressable onPress={() => setGraveyardVisible(false)} hitSlop={8}><Text style={styles.sheetClose}>✕</Text></Pressable>
            </View>
            <Text style={styles.sheetSub}>从计划移除的曲目会留在这里并记录时间；可以复原回计划，也可以强制彻底删除。</Text>
            <View style={styles.sheetList}>
              {graveyardRows.length === 0 ? (
                <View style={styles.graveyardEmpty}><Text style={styles.emptyText}>英灵殿是空的。移出的曲目会在这里安息。</Text></View>
              ) : graveyardRows.map(row => (
                <View key={`${row.removedAt}`} style={styles.graveRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.graveDiff, { color: DifficultyColorMap[row.entry.difficultyIndex] }]}>
                        {DifficultyLabels[row.entry.difficultyIndex] || `难度${row.entry.difficultyIndex}`}
                      </Text>
                      <Text style={styles.graveTitle} numberOfLines={1}>{row.music?.title || `曲目 ${row.entry.songId}`}</Text>
                    </View>
                    <Text style={styles.graveTime}>移除于 {new Date(row.removedAt).toLocaleString()}</Text>
                  </View>
                  <Pressable style={styles.restoreBtn} onPress={() => restoreGraveyardEntry(row.removedAt)} hitSlop={6}>
                    <Text style={styles.restoreText}>复原</Text>
                  </Pressable>
                  <Pressable
                    style={styles.purgeBtn}
                    onPress={() => setConfirmRequest({
                      title: '彻底删除',
                      message: `从英灵殿彻底删除《${row.music?.title || row.entry.songId}》？此操作不可恢复。`,
                      confirmText: '删除',
                      onConfirm: () => purgeGraveyardEntry(row.removedAt),
                    })}
                    hitSlop={6}
                  >
                    <Text style={styles.purgeText}>删除</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 自定义确认控件 */}
      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </View>
  );
}

function ConfirmDialog({ request, onCancel }: { request: ConfirmRequest | null; onCancel: () => void }) {
  return (
    <Modal transparent visible={request !== null} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dialogOverlay} onPress={onCancel}>
        <Pressable style={styles.dialogCard} onPress={event => event.stopPropagation()}>
          <Text style={styles.dialogTitle}>{request?.title}</Text>
          <Text style={styles.dialogMessage}>{request?.message}</Text>
          <View style={styles.dialogActions}>
            <Pressable style={styles.dialogCancel} onPress={onCancel}><Text style={styles.dialogCancelText}>取消</Text></Pressable>
            <Pressable
              style={styles.dialogConfirm}
              onPress={() => { request?.onConfirm(); onCancel(); }}
            >
              <Text style={styles.dialogConfirmText}>{request?.confirmText || '确定'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EmptyPlan() {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>🎯</Text><Text style={styles.emptyText}>暂未添加推分歌曲</Text><Text style={styles.emptySub}>在曲库或牌子查询中打开歌曲详情，选择难度后加入推分计划</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  graveyardButton: { padding: 2 },
  graveyardIcon: { fontSize: 18 },
  graveyardBadge: { position: 'absolute', top: -4, right: -6, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: Colors.functional.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  graveyardBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  headerSub: { fontSize: 12, lineHeight: 18, color: Colors.text.muted, marginTop: 2 },
  b50Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 6 },
  b50Entry: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  progressSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  progressSummaryInfo: { flex: 1, gap: 1 },
  progressSummaryTitle: { fontSize: 12, fontWeight: '800', color: Colors.text.primary },
  progressSummaryText: { fontSize: 10, color: Colors.text.muted },
  achieveFilterRow: { flexDirection: 'row', gap: 5 },
  achieveChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  achieveChipActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  achieveChipText: { fontSize: 10, fontWeight: '700', color: Colors.text.muted },
  achieveChipTextActive: { color: Colors.accent.primary },
  b50EntryText: { fontSize: 11, fontWeight: '800', color: Colors.accent.secondary },
  clearBtn: { fontSize: 14, color: Colors.functional.danger, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: Colors.bg.overlay, justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: Colors.bg.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '78%', gap: 10 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.text.primary },
  sheetClose: { fontSize: 15, color: Colors.text.muted },
  sheetSub: { fontSize: 11, lineHeight: 16, color: Colors.text.muted },
  sheetList: { gap: 7 },
  graveyardEmpty: { alignItems: 'center', paddingVertical: 28 },
  graveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 11, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light },
  graveDiff: { fontSize: 10, fontWeight: '800' },
  graveTitle: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  graveTime: { fontSize: 9, color: Colors.text.muted },
  restoreBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: `${Colors.accent.secondary}22` },
  restoreText: { fontSize: 11, color: Colors.accent.secondary, fontWeight: '800' },
  purgeBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: `${Colors.functional.danger}22` },
  purgeText: { fontSize: 11, color: Colors.functional.danger, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyIcon: { fontSize: 64 },
  emptyText: { fontSize: 16, color: Colors.text.muted, fontWeight: '600' },
  emptySub: { fontSize: 13, color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 24 },
  clearLink: { fontSize: 14, color: Colors.accent.primary, fontWeight: '700' },
  dialogOverlay: { flex: 1, backgroundColor: Colors.bg.overlay, alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialogCard: { width: '100%', maxWidth: 340, borderRadius: 16, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.medium, padding: 18, gap: 10 },
  dialogTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  dialogMessage: { fontSize: 12, lineHeight: 19, color: Colors.text.secondary },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  dialogCancel: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg.tertiary },
  dialogCancelText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '700' },
  dialogConfirm: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.functional.danger },
  dialogConfirmText: { fontSize: 13, color: '#fff', fontWeight: '800' },
});
