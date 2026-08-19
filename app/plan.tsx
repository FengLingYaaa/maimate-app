/** 推分计划：计划专属筛选、拖拽排序和左滑置顶/置底。 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import { FilterBar, PlanEntryCard } from '../src/components';
import { Colors } from '../src/constants';
import { getChinaVersionOptions, getVersionOptions } from '../src/data/version-catalog';
import { getMusicSearchScore, getOfficialChartConstant, matchesMusic } from '../src/data/music-list';
import type { FilterOptions, MusicData, PlanEntry, PlayerScore, SortOptions } from '../src/data/types';
import { useMusicStore, usePlanStore, useScoreStore, useSettingsStore } from '../src/store';

type PlanRow = { music: MusicData; entry: PlanEntry };

function rowKey(row: PlanRow): string {
  return `${row.music.type}:${row.music.id}:${row.entry.difficultyIndex}`;
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
  const removeEntry = usePlanStore(s => s.removeEntry);
  const updateTargetScore = usePlanStore(s => s.updateTargetScore);
  const clearPlan = usePlanStore(s => s.clearPlan);
  const reorder = usePlanStore(s => s.reorder);
  const moveToTop = usePlanStore(s => s.moveToTop);
  const moveToBottom = usePlanStore(s => s.moveToBottom);
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const settings = useSettingsStore(s => s.settings);
  const [filters, setFilters] = useState<FilterOptions>({});

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

  const genres = useMemo(() => [...new Set(plannedRows.map(row => row.music.basic_info.genre))].sort(), [plannedRows]);
  const versionOptions = useMemo(() => getVersionOptions(plannedRows.map(row => row.music)), [plannedRows]);
  const chinaVersionOptions = useMemo(() => getChinaVersionOptions(plannedRows.map(row => row.music)), [plannedRows]);
  const artists = useMemo(() => [...new Set(plannedRows.map(row => row.music.basic_info.artist))].sort(), [plannedRows]);
  const charters = useMemo(() => [...new Set(plannedRows.flatMap(row => row.music.charts.map(chart => chart.charter).filter(value => value && value !== '-')))].sort(), [plannedRows]);

  const getPreviewCount = useCallback((nextFilters: FilterOptions) => plannedRows.filter(row => matchesPlanRow(row, nextFilters)).length, [plannedRows]);
  const getScore = useCallback((music: MusicData, entry: PlanEntry): PlayerScore | undefined => scores.find(score => score.songId === music.id && score.difficultyIndex === entry.difficultyIndex && score.type === music.type), [scores]);

  const handleRemove = useCallback((row: PlanRow) => {
    Alert.alert('移出计划', '确定要从推分计划中移除此歌曲吗？', [
      { text: '取消', style: 'cancel' },
      { text: '移除', style: 'destructive', onPress: () => removeEntry(row.music.id, row.entry.difficultyIndex, row.music.type) },
    ]);
  }, [removeEntry]);

  const handleClear = useCallback(() => {
    Alert.alert('清空计划', '确定要清空整个推分计划吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: clearPlan },
    ]);
  }, [clearPlan]);

  const handleDragEnd = useCallback((data: PlanRow[]) => {
    if (data.length === 0) return;
    const visibleKeys = new Set(data.map(rowKey));
    const positions = entries.map((entry, index) => {
      const music = rawData.find(item => item.id === entry.songId && (!entry.musicType || item.type === entry.musicType)) || rawData.find(item => item.id === entry.songId);
      return music && visibleKeys.has(rowKey({ music, entry })) ? index : -1;
    }).filter(index => index >= 0);
    const next = [...entries];
    data.forEach((row, index) => { if (positions[index] !== undefined) next[positions[index]] = row.entry; });
    reorder(next);
  }, [entries, rawData, reorder]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📋 推分计划</Text>
          {entries.length > 0 && <Pressable onPress={handleClear}><Text style={styles.clearBtn}>清空</Text></Pressable>}
        </View>
        <Text style={styles.headerSub}>{entries.length > 0 ? `${entries.length} 首待练习` : '还没有添加歌曲'} · 长按拖拽，左滑显示置顶/置底</Text>
      </View>
      <FilterBar
        filters={filters}
        onApply={setFilters}
        onClear={() => setFilters({})}
        totalCount={plannedRows.length}
        filteredCount={filteredRows.length}
        getPreviewCount={getPreviewCount}
        genres={genres}
        versionOptions={versionOptions}
        chinaVersionOptions={chinaVersionOptions}
        artists={artists}
        charters={charters}
      />
      {plannedRows.length === 0 ? (
        <EmptyPlan />
      ) : filteredRows.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>没有匹配的计划条目</Text><Pressable onPress={() => setFilters({})}><Text style={styles.clearLink}>清除筛选</Text></Pressable></View>
      ) : (
        <DraggableFlatList
          data={filteredRows}
          keyExtractor={rowKey}
          onDragEnd={({ data }) => handleDragEnd(data)}
          activationDistance={8}
          contentContainerStyle={styles.listContent}
          renderItem={(params) => <SortablePlanRow {...params} showChinaVersion={settings.showChinaVersion} rawData={rawData} getScore={getScore} onOpen={row => router.push({ pathname: '/song/[id]' as any, params: { id: row.music.id, type: row.music.type, difficultyIndex: String(row.entry.difficultyIndex), source: 'plan' } })} onRemove={handleRemove} onTarget={(row, value) => updateTargetScore(row.music.id, row.entry.difficultyIndex, value, row.music.type)} onTop={row => moveToTop(row.music.id, row.entry.difficultyIndex, row.music.type)} onBottom={row => moveToBottom(row.music.id, row.entry.difficultyIndex, row.music.type)} />}
        />
      )}
    </View>
  );
}

function SortablePlanRow({ item, getIndex, drag, isActive, showChinaVersion, rawData, getScore, onOpen, onRemove, onTarget, onTop, onBottom }: RenderItemParams<PlanRow> & {
  showChinaVersion: boolean;
  rawData: MusicData[];
  getScore: (music: MusicData, entry: PlanEntry) => PlayerScore | undefined;
  onOpen: (row: PlanRow) => void;
  onRemove: (row: PlanRow) => void;
  onTarget: (row: PlanRow, value: number | null) => void;
  onTop: (row: PlanRow) => void;
  onBottom: (row: PlanRow) => void;
}) {
  const swipeable = useRef<Swipeable>(null);
  return (
    <ScaleDecorator activeScale={1.03}>
      <Swipeable ref={swipeable} overshootRight={false} renderRightActions={() => (
        <View style={styles.swipeActions}>
          <Pressable style={[styles.swipeButton, styles.topButton]} onPress={() => { onTop(item); swipeable.current?.close(); }}><Text style={styles.swipeText}>置顶</Text></Pressable>
          <Pressable style={[styles.swipeButton, styles.bottomButton]} onPress={() => { onBottom(item); swipeable.current?.close(); }}><Text style={styles.swipeText}>置底</Text></Pressable>
        </View>
      )}>
        <View style={[styles.draggableRow, isActive && styles.activeRow]}>
          <PlanEntryCard music={item.music} entry={item.entry} index={getIndex() ?? 0} allSongs={rawData} importedScore={getScore(item.music, item.entry)} showChinaVersion={showChinaVersion} onPress={() => onOpen(item)} onLongPress={drag} onRemove={() => onRemove(item)} onTarget={value => onTarget(item, value)} />
        </View>
      </Swipeable>
    </ScaleDecorator>
  );
}

function EmptyPlan() {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>🎯</Text><Text style={styles.emptyText}>暂未添加推分歌曲</Text><Text style={styles.emptySub}>在曲库中打开歌曲详情，选择难度后加入推分计划</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text.primary },
  headerSub: { fontSize: 12, lineHeight: 18, color: Colors.text.muted, marginTop: 2 },
  clearBtn: { fontSize: 14, color: Colors.functional.danger, fontWeight: '600' },
  listContent: { paddingBottom: 80 },
  draggableRow: { backgroundColor: Colors.bg.primary },
  activeRow: { opacity: 0.92 },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch', marginVertical: 5, marginRight: 12, borderRadius: 12, overflow: 'hidden' },
  swipeButton: { width: 52, alignItems: 'center', justifyContent: 'center' },
  topButton: { backgroundColor: Colors.accent.secondary },
  bottomButton: { backgroundColor: Colors.accent.primary },
  swipeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyIcon: { fontSize: 64 },
  emptyText: { fontSize: 16, color: Colors.text.muted, fontWeight: '600' },
  emptySub: { fontSize: 13, color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 24 },
  clearLink: { fontSize: 14, color: Colors.accent.primary, fontWeight: '700' },
});
