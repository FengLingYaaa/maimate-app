import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, DifficultyColorMap, DifficultyLabels, DifficultyShortLabels } from '../../../src/constants';
import { LIST_BOTTOM_INSET } from '../../../src/constants/layout';
import { CoverImage } from '../../../src/components';
import { useMusicStore, usePlanStore, useScoreStore } from '../../../src/store';
import {
  buildPlateEntries,
  filterPlateEntries,
  filterEntriesByMinLevel,
  getPlateChinaVersionOptions,
  getPlateLegacyVersionOptions,
  mergePlateRows,
  PLATE_BITS,
  summarizePlates,
  summarizePlatesByDifficulty,
  type PlateBit,
} from '../../../src/data/plates';

const PLATE_LABELS: Array<{ name: PlateBit; label: string; color: string }> = [
  { name: 'FC', label: 'FC', color: Colors.functional.success },
  { name: 'SSS', label: 'SSS', color: Colors.accent.secondary },
  { name: 'FSD', label: 'FS', color: '#c084fc' },
  { name: 'AP', label: 'AP', color: '#fb923c' },
];

export default function PlatesPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawData = useMusicStore(s => s.rawData);
  const scores = useScoreStore(s => s.scores);
  const entries = usePlanStore(s => s.entries);
  const isInPlan = usePlanStore(s => s.isInPlan);
  const bulkAddEntries = usePlanStore(s => s.bulkAddEntries);
  const bulkRemoveEntries = usePlanStore(s => s.bulkRemoveEntries);

  // v1.13.0：牌子页状态记忆——筛选与展开状态持久化，下次进入保持。
  const PLATES_STATE_KEY = 'maimate_plates_ui_state';
  const [version, setVersion] = useState('全部');
  const [chinaVersion, setChinaVersion] = useState<string | undefined>();
  const [difficultyIndex, setDifficultyIndex] = useState<number | undefined>();
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [showLowDifficulties, setShowLowDifficulties] = useState(false);
  const [stateHydrated, setStateHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PLATES_STATE_KEY);
        if (raw && !cancelled) {
          const saved = JSON.parse(raw) as { version?: string; chinaVersion?: string; difficultyIndex?: number; filtersCollapsed?: boolean; showLowDifficulties?: boolean };
          if (typeof saved.version === 'string') setVersion(saved.version);
          if (typeof saved.chinaVersion === 'string') setChinaVersion(saved.chinaVersion);
          if (typeof saved.difficultyIndex === 'number') setDifficultyIndex(saved.difficultyIndex);
          if (typeof saved.filtersCollapsed === 'boolean') setFiltersCollapsed(saved.filtersCollapsed);
          if (typeof saved.showLowDifficulties === 'boolean') setShowLowDifficulties(saved.showLowDifficulties);
        }
      } catch {
        // 读取失败用默认值。
      } finally {
        if (!cancelled) setStateHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateHydrated) return;
    AsyncStorage.setItem(PLATES_STATE_KEY, JSON.stringify({ version, chinaVersion, difficultyIndex, filtersCollapsed, showLowDifficulties }))
      .catch(() => undefined);
  }, [stateHydrated, version, chinaVersion, difficultyIndex, filtersCollapsed, showLowDifficulties]);

  const [lastBulkKeys, setLastBulkKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // 进入页面时强制刷新一次：修复嵌套 Stack 初次渲染偶发空白、
  // 点击筛选后才显示的问题。
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick(tick => tick + 1); }, []));
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const plateEntries = useMemo(
    () => buildPlateEntries(rawData, scores),
    // focusTick 参与依赖，切回该页时重新计算一次。
    [rawData, scores, focusTick],
  );
  const filtered = useMemo(
    () => filterPlateEntries(plateEntries, version, difficultyIndex, chinaVersion),
    [plateEntries, version, difficultyIndex, chinaVersion],
  );
  const legacyVersions = useMemo(() => getPlateLegacyVersionOptions(plateEntries), [plateEntries]);
  const chinaOptions = useMemo(() => getPlateChinaVersionOptions(plateEntries), [plateEntries]);
  const byDifficulty = useMemo(() => summarizePlatesByDifficulty(filtered), [filtered]);
  const total = useMemo(() => summarizePlates(filtered), [filtered]);
  const mergedRows = useMemo(() => {
    const rows = mergePlateRows(filtered);
    // v1.13.0：按 Master（难度 3）定数从大到小排布；无 Master 定数的曲排末尾。
    return [...rows].sort((left, right) => {
      const leftDs = left.music.ds[3];
      const rightDs = right.music.ds[3];
      if (Number.isFinite(leftDs) && Number.isFinite(rightDs)) return rightDs - leftDs;
      if (Number.isFinite(leftDs)) return -1;
      if (Number.isFinite(rightDs)) return 1;
      return left.music.id.localeCompare(right.music.id);
    });
  }, [filtered]);
  // 总计卡与曲目行按同一开关过滤低难度；空数组表示全难度。
  const visibleDifficulties = useMemo(
    () => (showLowDifficulties ? undefined : [3, 4]),
    [showLowDifficulties],
  );
  const visibleByDifficulty = useMemo(
    () => (visibleDifficulties ? byDifficulty.filter(row => visibleDifficulties.includes(row.difficultyIndex)) : byDifficulty),
    [byDifficulty, visibleDifficulties],
  );
  const visibleTotal = useMemo(
    () => (visibleDifficulties
      ? {
        total: filtered.filter(entry => visibleDifficulties.includes(entry.difficultyIndex)).length,
        counts: PLATE_LABELS.reduce((acc, item) => {
          acc[item.name] = filtered
            .filter(entry => visibleDifficulties.includes(entry.difficultyIndex))
            .reduce((sum, entry) => sum + ((entry.mask & PLATE_BITS[item.name]) !== 0 ? 1 : 0), 0);
          return acc;
        }, {} as Record<PlateBit, number>),
      }
      : total),
    [filtered, total, visibleDifficulties],
  );
  const hasLowDifficulties = useMemo(() => byDifficulty.some(row => row.difficultyIndex <= 2), [byDifficulty]);

  const eligible14Plus = useMemo(() => filterEntriesByMinLevel(filtered, 14), [filtered]);
  const pendingCount = useMemo(
    () => eligible14Plus.filter(entry => !isInPlan(entry.music.id, entry.difficultyIndex, entry.music.type)).length,
    [eligible14Plus, isInPlan],
  );

  const openSong = useCallback((row: ReturnType<typeof mergePlateRows>[number]) => {
    const highest = row.charts[row.charts.length - 1];
    router.push({
      pathname: '/song/[id]' as any,
      params: { id: row.music.id, type: row.music.type, difficultyIndex: String(highest.difficultyIndex), source: 'plates' },
    });
  }, [router]);

  const handleBulkAdd = () => {
    if (eligible14Plus.length === 0) return;
    const added = bulkAddEntries(eligible14Plus.map(entry => ({
      songId: entry.music.id,
      difficultyIndex: entry.difficultyIndex,
      musicType: entry.music.type,
    })));
    if (added.length === 0) {
      setNotice('选中的 14 以上谱面都已在推分计划中');
      return;
    }
    setLastBulkKeys(added);
    setNotice(`已把 ${added.length} 张 14 以上谱面加入推分计划`);
  };

  const handleBulkUndo = () => {
    if (lastBulkKeys.length === 0) return;
    bulkRemoveEntries(lastBulkKeys, { purge: true });
    setNotice(`已撤回 ${lastBulkKeys.length} 张谱面`);
    setLastBulkKeys([]);
  };

  const listHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>🏅 本地牌子查询</Text>
      </View>

      <Pressable style={styles.filterToggle} onPress={() => setFiltersCollapsed(value => !value)}>
        <Text style={styles.filterToggleText}>
          {filtersCollapsed
            ? `筛选：${version === '全部' ? '全部版本' : version} · ${chinaVersion || '全部国区'} · ${difficultyIndex === undefined ? '全部难度' : DifficultyLabels[difficultyIndex]}`
            : '筛选（点击收起）'}
        </Text>
        <Text style={styles.filterToggleArrow}>{filtersCollapsed ? '▼' : '▲'}</Text>
      </Pressable>
      {!filtersCollapsed && (
        <>
          <View style={styles.chips}>
            {legacyVersions.map(option => <FilterChip key={option} label={option === '全部' ? '全部版本' : option} active={version === option} onPress={() => setVersion(option)} />)}
          </View>
          <View style={styles.chips}>
            <FilterChip label="全部国区" active={!chinaVersion} onPress={() => setChinaVersion(undefined)} />
            {chinaOptions.map(option => <FilterChip key={option} label={option} active={chinaVersion === option} onPress={() => setChinaVersion(option)} />)}
          </View>
          <View style={styles.chips}>
            <FilterChip label="全部难度" active={difficultyIndex === undefined} onPress={() => setDifficultyIndex(undefined)} />
            {DifficultyLabels.map((label, index) => (
              <FilterChip
                key={label}
                label={label}
                active={difficultyIndex === index}
                onPress={() => setDifficultyIndex(index)}
                color={DifficultyColorMap[index]}
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.summaryCard}>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>总计</Text>
          <View style={styles.summaryCells}>{PLATE_LABELS.map(item => <SummaryCell key={item.name} item={item} counts={visibleTotal.counts} total={visibleTotal.total} />)}</View>
        </View>
        {visibleByDifficulty.map(row => (
          <View key={row.difficultyIndex} style={styles.summaryRow}>
            <Text style={[styles.diffLabel, { color: DifficultyColorMap[row.difficultyIndex] }]}>
              {DifficultyShortLabels[row.difficultyIndex] || `难度${row.difficultyIndex}`}
            </Text>
            <View style={styles.summaryCells}>{PLATE_LABELS.map(item => <SummaryCell key={item.name} item={item} counts={row.counts} total={row.total} />)}</View>
          </View>
        ))}
        {hasLowDifficulties && (
          <Pressable style={styles.diffToggleButton} onPress={() => setShowLowDifficulties(value => !value)}>
            <Text style={styles.diffToggleText}>{showLowDifficulties ? '收起低难度' : `展开低难度（${byDifficulty.filter(row => row.difficultyIndex <= 2).length} 行）`}</Text>
          </Pressable>
        )}
      </View>

      {(eligible14Plus.length > 0 || lastBulkKeys.length > 0) && (
        <View style={styles.bulkBar}>
          <Pressable
            style={({ pressed }) => [styles.bulkButton, pressed && styles.pressed, pendingCount === 0 && styles.bulkDisabled]}
            onPress={handleBulkAdd}
            disabled={pendingCount === 0}
          >
            <Text style={styles.bulkButtonText}>⚡ 一键加入 14 以上谱面（{pendingCount}）</Text>
          </Pressable>
          {lastBulkKeys.length > 0 && (
            <Pressable style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]} onPress={handleBulkUndo}>
              <Text style={styles.undoButtonText}>↩ 撤回本次（{lastBulkKeys.length}）</Text>
            </Pressable>
          )}
        </View>
      )}
      {notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}
    </>
  );

  const listEmpty = scores.length === 0 ? (
    <View style={styles.empty}><Text style={styles.emptyTitle}>暂无本地成绩</Text><Text style={styles.emptyText}>请先在设置中导入成绩，再查询 FC、SSS、FS 和 AP 牌子。</Text></View>
  ) : (
    <View style={styles.empty}><Text style={styles.emptyTitle}>没有可查询的谱面</Text><Text style={styles.emptyText}>当前筛选条件没有匹配曲目。</Text></View>
  );

  return (
    // 整树 key 重挂载：切回本页时强制全新子树，彻底规避嵌套 Stack
    // 首帧测量异常（配合 chips 换行容器修复初始无字问题）。
    <View key={`plates-root-${focusTick}`} style={styles.container}>
      <Stack.Screen options={{ title: '牌子查询', headerStyle: { backgroundColor: Colors.bg.primary }, headerTintColor: Colors.text.primary }} />
      <FlatList
        data={mergedRows}
        keyExtractor={item => item.key}
        removeClippedSubviews={false}
        contentContainerStyle={[styles.list, { paddingBottom: LIST_BOTTOM_INSET + insets.bottom }]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        renderItem={({ item }) => (
          <PlateRow
            entry={item}
            plannedCount={entries.filter(e => e.songId === item.music.id).length}
            showLowDifficulties={showLowDifficulties}
            onPress={() => openSong(item)}
          />
        )}
      />
    </View>
  );
}

function SummaryCell({ item, counts, total }: { item: { name: PlateBit; label: string; color: string }; counts: Record<PlateBit, number>; total: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryLabel, { color: item.color }]}>{item.label}</Text>
      <Text style={styles.summaryValue}>{counts[item.name]}<Text style={styles.summaryTotal}>/{total}</Text></Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return <Pressable style={[styles.chip, active && { borderColor: color || Colors.accent.primary, backgroundColor: `${color || Colors.accent.primary}22` }]} onPress={onPress}><Text style={[styles.chipText, active && { color: color || Colors.accent.primary, fontWeight: '800' }]}>{label}</Text></Pressable>;
}

function PlateChartLine({ chart }: { chart: { difficultyIndex: number; mask: number; level?: string; ds?: number } }) {
  const color = DifficultyColorMap[chart.difficultyIndex];
  return (
    <View style={styles.chartLine}>
      <View style={[styles.diffBadge, { borderColor: color }]}>
        <Text style={[styles.diffBadgeText, { color }]}>
          {DifficultyShortLabels[chart.difficultyIndex] || `D${chart.difficultyIndex}`}
          {chart.ds !== undefined && Number.isFinite(chart.ds) ? ` ${chart.ds.toFixed(1)}` : chart.level ? ` ${chart.level}` : ''}
        </Text>
      </View>
      <View style={styles.badgeMarks}>
        {PLATE_LABELS.map(item => {
          const earned = (chart.mask & ({ FC: 1, SSS: 2, FSD: 4, AP: 8 } as const)[item.name]) !== 0;
          return (
            <Text key={item.name} style={[styles.mark, { color: earned ? item.color : Colors.text.muted }]}>
              {earned ? '✓' : '○'}{item.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function PlateRow({ entry, plannedCount, showLowDifficulties, onPress }: {
  entry: ReturnType<typeof mergePlateRows>[number];
  plannedCount: number;
  showLowDifficulties: boolean;
  onPress: () => void;
}) {
  const visibleCharts = showLowDifficulties ? entry.charts : entry.charts.filter(chart => chart.difficultyIndex >= 3);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <CoverImage music={entry.music} style={styles.cover} accessibilityLabel={`${entry.music.title} 曲绘`} />
      <View style={styles.rowInfo}>
        <View style={styles.titleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>{entry.music.title}</Text>
          {plannedCount > 0 && <View style={styles.planTag}><Text style={styles.planTagText}>计划×{plannedCount}</Text></View>}
        </View>
        <Text style={styles.rowMeta}>{entry.music.type} · {entry.music.basic_info.from}</Text>
        {visibleCharts.map(chart => <PlateChartLine key={chart.difficultyIndex} chart={chart} />)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 23, fontWeight: '800', color: Colors.text.primary },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.bg.secondary },
  chipText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '700' },
  filterToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light },
  filterToggleText: { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.text.secondary },
  filterToggleArrow: { fontSize: 11, color: Colors.text.muted, fontWeight: '700' },
  summaryCard: { marginHorizontal: 12, marginVertical: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light, gap: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: { borderBottomWidth: 1, borderBottomColor: Colors.border.light, paddingBottom: 6, marginBottom: 2 },
  totalLabel: { fontSize: 12, fontWeight: '800', color: Colors.text.primary, width: 34 },
  diffLabel: { fontSize: 11, fontWeight: '800', width: 34 },
  summaryCells: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', minWidth: 52 },
  summaryLabel: { fontSize: 10, fontWeight: '800' },
  summaryValue: { fontSize: 12, color: Colors.text.primary, fontWeight: '800' },
  summaryTotal: { fontSize: 9, color: Colors.text.muted, fontWeight: '600' },
  diffToggleButton: { alignSelf: 'center', marginTop: 2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.bg.tertiary },
  diffToggleText: { fontSize: 10, fontWeight: '700', color: Colors.accent.secondary },
  bulkBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  bulkButton: { flex: 1, backgroundColor: Colors.accent.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bulkDisabled: { opacity: 0.45 },
  bulkButtonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  undoButton: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.medium, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  undoButtonText: { fontSize: 12, fontWeight: '800', color: Colors.text.secondary },
  pressed: { opacity: 0.75 },
  notice: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: 'rgba(25,25,34,0.94)' },
  noticeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 12, gap: 6 },
  row: { padding: 11, borderRadius: 11, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light, flexDirection: 'row', gap: 10 },
  rowPressed: { backgroundColor: Colors.bg.tertiary, borderColor: Colors.border.accent },
  cover: { width: 56, height: 56, borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  rowInfo: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  planTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${Colors.accent.primary}22` },
  planTagText: { fontSize: 9, color: Colors.accent.primary, fontWeight: '800' },
  rowMeta: { fontSize: 10, color: Colors.text.muted },
  chartLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffBadge: { minWidth: 56, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  diffBadgeText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  badgeMarks: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mark: { fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 48 },
  emptyTitle: { fontSize: 16, color: Colors.text.primary, fontWeight: '700' },
  emptyText: { fontSize: 12, color: Colors.text.muted },
});
