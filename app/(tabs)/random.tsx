/**
 * 随机抽歌页 — 推分计划、全曲库和按条件抽选。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicStore, usePlanStore, useScoreStore } from '../../src/store';
import { DrumRoll, RangeSlider } from '../../src/components';
import { Colors, DifficultyColorMap, DifficultyLabels, DifficultyShortLabels, MusicTypes } from '../../src/constants';
import { getMatchingDifficultyIndices, MusicList } from '../../src/data/music-list';
import { getVersionOptions } from '../../src/data/version-catalog';
import {
  getTodayRecord,
  recordDraw,
  clearFallbackFlag,
  resetToday,
  getRecentHistory,
  localDateKey,
  type DayRecord,
  type DrawMode as StoreDrawMode,
} from '../../src/data/plan-draw-history';
import { computeAchievedIds, resolvePlanMusic } from '../../src/data/plan-entries';
import type { DrawCandidate, FilterOptions, PlanEntry, PlayerScore } from '../../src/data/types';

type DrawMode = StoreDrawMode;

const MODE_LABELS: Record<DrawMode, string> = { plan: '计划', any: '全曲', filtered: '条件' };

function toggleValue<T extends string | number>(current: T | T[] | undefined, value: T): T | T[] | undefined {
  if (current === undefined) return value;
  const values = Array.isArray(current) ? [...current] : [current];
  if (values.includes(value)) {
    const next = values.filter(item => item !== value);
    return next.length > 0 ? next : undefined;
  }
  return [...values, value];
}

export default function RandomPicker() {
  const router = useRouter();
  const rawData = useMusicStore(s => s.rawData);
  const planEntries = usePlanStore(s => s.entries);
  const scores = useScoreStore(s => s.scores);

  const [mode, setMode] = useState<DrawMode>('plan');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showVersions, setShowVersions] = useState(false);
  // 「按条件」模式下抽选时自动收起条件面板：否则滚筒+结果卡会被
  // 底部抽选按钮挤压/遮挡。
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [animationItems, setAnimationItems] = useState<DrawCandidate[]>([]);
  const [animationResultIndex, setAnimationResultIndex] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  // v1.16.2：计划抽歌默认排除已达标曲目（可手动包含）。
  const [includeAchieved, setIncludeAchieved] = useState(false);
  // v1.16.6：三模式通用的每日记录（去重键集 + 抽取次数 + 回落标记）。
  const [todayRecord, setTodayRecord] = useState<DayRecord>({ keys: [], draws: 0, fallback: false });
  // v1.16.2：抽歌历史弹层。
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyDays, setHistoryDays] = useState<Awaited<ReturnType<typeof getRecentHistory>>>([]);
  const [historyModeFilter, setHistoryModeFilter] = useState<'all' | DrawMode>('all');
  // v1.16.2：本次抽选是否回落到全量池（今日已抽遍时提示）。
  const [lastDrawFallback, setLastDrawFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTodayRecord(mode).then(record => {
      if (!cancelled) setTodayRecord(record);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const genres = useMemo(() => [...new Set(rawData.map(music => music.basic_info.genre))].sort(), [rawData]);
  const versionOptions = useMemo(() => getVersionOptions(rawData), [rawData]);
  /** 计划条目是否已达标（有目标分且当前成绩 ≥ 目标）；与计划页共用同一判定口径。 */
  const achievedPlanIds = useMemo(() => computeAchievedIds(planEntries, scores, rawData), [planEntries, scores, rawData]);

  const planCandidates = useMemo<DrawCandidate[]>(() => {
    return planEntries
      .slice()
      .sort((left, right) => left.order - right.order)
      .flatMap(entry => {
        if (!includeAchieved && achievedPlanIds.has(entry.entryId)) return [];
        const music = resolvePlanMusic(entry, rawData, scores);
        if (!music || entry.difficultyIndex < 0 || entry.difficultyIndex >= music.charts.length) return [];
        return [{ music, difficultyIndex: entry.difficultyIndex, planEntry: entry }];
      });
  }, [achievedPlanIds, includeAchieved, planEntries, rawData, scores]);

  const candidates = useMemo<DrawCandidate[]>(() => {
    if (mode === 'plan') return planCandidates;
    const list = mode === 'any' ? new MusicList(rawData) : new MusicList(rawData).filter(filters);
    const songs = list.all();
    const chartConstrained = mode === 'filtered' && (
      filters.difficulty !== undefined ||
      filters.level !== undefined ||
      filters.dsRange !== undefined ||
      filters.charter !== undefined
    );
    if (!chartConstrained) return songs.map(music => ({ music }));

    return songs.flatMap(music => getMatchingDifficultyIndices(music, filters).map(difficultyIndex => ({
      music,
      difficultyIndex,
    })));
  }, [filters, mode, planCandidates, rawData]);

  const setModeAndReset = (nextMode: DrawMode) => {
    if (spinning) return;
    setMode(nextMode);
    setAnimationItems([]);
    setAnimationResultIndex(null);
  };

  const updateFilters = (next: FilterOptions) => {
    if (spinning) return;
    setFilters(next);
    setAnimationItems([]);
    setAnimationResultIndex(null);
  };

  const updateTextFilter = (key: 'titleSearch' | 'artist' | 'charter', value: string) => {
    updateFilters({ ...filters, [key]: value || undefined });
  };

  /** 计划条目键（每日不重复记录用，与抽歌历史存储对齐）。 */
  const candidateKey = useCallback((candidate: DrawCandidate): string => {
    const musicType = candidate.planEntry?.musicType || candidate.music.type;
    return `${musicType}:${candidate.music.id}:${candidate.difficultyIndex ?? -1}`;
  }, []);

  const handleDraw = useCallback(() => {
    if (candidates.length === 0 || spinning) return;
    // v1.16.6：三模式统一「今日不重复优先」——优先从今天没抽过的池子里选。
    let pool = candidates;
    let usedFallback = false;
    if (todayRecord.keys.length > 0) {
      const fresh = candidates.filter(candidate => !todayRecord.keys.includes(candidateKey(candidate)));
      if (fresh.length > 0) {
        pool = fresh;
      } else {
        usedFallback = true;
      }
    }
    const target = pool[Math.floor(Math.random() * pool.length)];
    const decoys = candidates.filter(candidate => candidate !== target);
    const displayItems: DrawCandidate[] = [];
    for (let i = 0; i < 32; i += 1) {
      const source = decoys.length > 0 ? decoys[i % decoys.length] : target;
      displayItems.push(source);
    }
    displayItems.push(target);
    setAnimationItems(displayItems);
    setAnimationResultIndex(displayItems.length - 1);
    setSpinning(true);
    if (mode === 'filtered') setFiltersCollapsed(true);
    // 记录：次数 +1（抽到重复也算一次）；键去重；回落持久化。
    const key = candidateKey(target);
    setTodayRecord(previous => ({
      keys: previous.keys.includes(key) ? previous.keys : [...previous.keys, key],
      draws: previous.draws + 1,
      fallback: previous.fallback || usedFallback,
    }));
    void recordDraw(mode, key, usedFallback);
    setLastDrawFallback(usedFallback);
  }, [candidateKey, candidates, mode, spinning, todayRecord]);

  const handleSpinEnd = useCallback(() => {
    setSpinning(false);
  }, []);

  const handleResultPress = useCallback((candidate: DrawCandidate) => {
    if (spinning) return;
    router.push({
      pathname: '/song/[id]' as any,
      params: {
        id: candidate.music.id,
        type: candidate.music.type,
        difficultyIndex: candidate.difficultyIndex === undefined ? undefined : String(candidate.difficultyIndex),
        source: 'random',
      },
    });
  }, [router, spinning]);

  /** 打开抽歌历史弹层：读最近 7 天全模式记录。 */
  const openDrawHistory = useCallback(async () => {
    try {
      setHistoryDays(await getRecentHistory(7));
    } catch {
      setHistoryDays([]);
    }
    setHistoryVisible(true);
  }, []);

  // v1.16.6：计划加入新曲目后，清除「已抽遍」回落标记让全量提示消失。
  // 判定：计划池出现了 todayRecord.keys 之外的新键。
  const planKeysRef = useRef<string>('');
  useEffect(() => {
    const planKeys = planCandidates.map(candidate => candidateKey(candidate)).sort().join('|');
    const previousKeys = planKeysRef.current;
    planKeysRef.current = planKeys;
    if (previousKeys === '') return;
    if (mode !== 'plan' || previousKeys === planKeys) return;
    const addedNew = planKeys
      .split('|')
      .some(key => key && !todayRecord.keys.includes(key));
    if (addedNew && todayRecord.fallback) {
      void clearFallbackFlag('plan');
      setTodayRecord(previous => ({ ...previous, fallback: false }));
      setLastDrawFallback(false);
    }
  }, [candidateKey, mode, planCandidates, todayRecord]);

  const activeRange: [number, number] = filters.dsRange || [0, 15];
  const candidateLabel = mode === 'plan' ? `${candidates.length} 个计划谱面` : `${candidates.length} 个候选`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎲 随机抽歌</Text>
        <Text style={styles.headerSub}>{candidateLabel}</Text>
      </View>

      <View style={styles.modeRow}>
        <Pressable style={[styles.modeBtn, mode === 'plan' && styles.modeBtnActive]} onPress={() => setModeAndReset('plan')}>
          <Text style={[styles.modeBtnText, mode === 'plan' && styles.modeBtnTextActive]}>推分计划</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === 'any' && styles.modeBtnActive]} onPress={() => setModeAndReset('any')}>
          <Text style={[styles.modeBtnText, mode === 'any' && styles.modeBtnTextActive]}>全曲随机</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === 'filtered' && styles.modeBtnActive]} onPress={() => setModeAndReset('filtered')}>
          <Text style={[styles.modeBtnText, mode === 'filtered' && styles.modeBtnTextActive]}>按条件</Text>
        </Pressable>
      </View>

      {mode === 'plan' && (
        <View style={styles.planOptionRow}>
          <Pressable style={styles.planToggle} onPress={() => setIncludeAchieved(value => !value)}>
            <Text style={[styles.planToggleText, includeAchieved && styles.planToggleTextActive]}>
              {includeAchieved ? '✓ ' : ''}含已达标
            </Text>
          </Pressable>
          <Pressable style={styles.planToggle} onPress={openDrawHistory}>
            <Text style={styles.planToggleText}>抽歌历史</Text>
          </Pressable>
          {todayRecord.draws > 0 && (
            <Text style={styles.drawnHint}>今日已抽 {todayRecord.draws} 次（不重复优先）</Text>
          )}
        </View>
      )}

      {mode !== 'plan' && (
        <View style={styles.planOptionRow}>
          <Pressable style={styles.planToggle} onPress={openDrawHistory}>
            <Text style={styles.planToggleText}>抽歌历史</Text>
          </Pressable>
          {todayRecord.draws > 0 && (
            <Text style={styles.drawnHint}>今日已抽 {todayRecord.draws} 次（不重复优先）</Text>
          )}
        </View>
      )}

      {mode === 'plan' && planEntries.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>推分计划还是空的，请先在曲库中添加歌曲。</Text>
        </View>
      )}

      {mode === 'filtered' && !filtersCollapsed && (
        <ScrollView style={styles.filterPanel} horizontal={false} showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.searchInput}
            placeholder="模糊搜索歌曲名、曲师或谱师..."
            placeholderTextColor={Colors.text.muted}
            value={filters.titleSearch || ''}
            onChangeText={value => updateTextFilter('titleSearch', value)}
          />

          <Text style={styles.filterLabel}>难度颜色</Text>
          <View style={styles.chipRow}>
            {DifficultyLabels.map((label, index) => {
              const active = Array.isArray(filters.difficulty) ? filters.difficulty.includes(index) : filters.difficulty === index;
              return (
                <Pressable
                  key={index}
                  style={[styles.chip, active && { backgroundColor: `${DifficultyColorMap[index]}33`, borderColor: DifficultyColorMap[index] }]}
                  onPress={() => updateFilters({ ...filters, difficulty: toggleValue(filters.difficulty, index) as FilterOptions['difficulty'] })}
                >
                  <Text style={[styles.chipText, active && { color: DifficultyColorMap[index] }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <RangeSlider
            value={activeRange}
            onChange={range => updateFilters({ ...filters, dsRange: range[0] <= 0 && range[1] >= 15 ? undefined : range })}
          />

          <Text style={styles.filterLabel}>分类</Text>
          <View style={styles.chipRow}>
            {genres.map(genre => {
              const active = Array.isArray(filters.genre) ? filters.genre.includes(genre) : filters.genre === genre;
              return (
                <Pressable key={genre} style={[styles.chip, active && styles.chipActive]} onPress={() => updateFilters({ ...filters, genre: toggleValue(filters.genre, genre) as FilterOptions['genre'] })}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>类型</Text>
          <View style={styles.chipRow}>
            {MusicTypes.map(type => {
              const active = Array.isArray(filters.type) ? filters.type.includes(type) : filters.type === type;
              return (
                <Pressable key={type} style={[styles.chip, active && styles.chipActive]} onPress={() => updateFilters({ ...filters, type: toggleValue(filters.type, type) as FilterOptions['type'] })}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.expandHeader}>
            <Text style={styles.filterLabel}>版本</Text>
            <Pressable onPress={() => setShowVersions(value => !value)}>
              <Text style={styles.expandText}>{showVersions ? '收起' : `展开全部（${versionOptions.length}）`}</Text>
            </Pressable>
          </View>
          {showVersions ? (
            <View style={styles.chipRow}>
              {versionOptions.map(option => {
                const active = Array.isArray(filters.version) ? filters.version.includes(option.rawValue) : filters.version === option.rawValue;
                return (
                  <Pressable key={option.rawValue} style={[styles.chip, active && styles.chipActive, option.count === 0 && styles.emptyVersionChip]} onPress={() => updateFilters({ ...filters, version: toggleValue(filters.version, option.rawValue) as FilterOptions['version'] })}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                     <Text style={[styles.versionCount, active && styles.chipTextActive]}>{option.count === 0 ? '暂无' : option.count}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.collapsedHint}>
              {Array.isArray(filters.version) ? `${filters.version.length} 个版本已选择` : filters.version || '未选择版本'}
            </Text>
          )}

          <Text style={styles.filterLabel}>曲师关键词</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="例如：cosMo"
            placeholderTextColor={Colors.text.muted}
            value={filters.artist || ''}
            onChangeText={value => updateTextFilter('artist', value)}
          />
          <Text style={styles.filterLabel}>谱师关键词</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="例如：譜面-100号"
            placeholderTextColor={Colors.text.muted}
            value={filters.charter || ''}
            onChangeText={value => updateTextFilter('charter', value)}
          />
        </ScrollView>
      )}

      {mode === 'filtered' && (
        <Pressable style={styles.filterToggle} onPress={() => setFiltersCollapsed(value => !value)}>
          <Text style={styles.filterToggleText}>
            {filtersCollapsed ? '⚙ 展开筛选条件' : '▲ 收起筛选条件，给抽选区让位'}
          </Text>
        </Pressable>
      )}

      <View style={styles.drumArea}>
        {animationItems.length > 0 && animationResultIndex !== null ? (
          <DrumRoll
            items={animationItems}
            resultIndex={animationResultIndex}
            spinning={spinning}
            onSpinEnd={handleSpinEnd}
            onResultPress={handleResultPress}
             allSongs={rawData}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {candidates.length === 0
                ? mode === 'plan' ? '推分计划中没有可抽的谱面' : '没有符合条件的歌曲'
                : '点击下方按钮开始抽选'}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.drawBtn, (spinning || candidates.length === 0) && styles.drawBtnDisabled]}
        onPress={handleDraw}
        disabled={spinning || candidates.length === 0}
      >
        <Text style={styles.drawBtnText}>
          {spinning ? '🌀 旋转中...' : `🎰 抽一项（${candidateLabel}）`}
        </Text>
      </Pressable>

      {lastDrawFallback && todayRecord.fallback && !spinning && (
        <View style={styles.fallbackNotice}>
          <Text style={styles.fallbackNoticeText}>今天{MODE_LABELS[mode]}的谱面已抽遍，本次从全量池抽取</Text>
        </View>
      )}

      {/* v1.16.6：抽歌历史弹层（最近 7 天 × 三模式，可筛选）。 */}
      {historyVisible && (
        <View style={styles.historyBackdrop}>
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>抽歌历史（最近 7 天）</Text>
            <View style={styles.historyFilterRow}>
              {(['all', 'plan', 'any', 'filtered'] as const).map(value => (
                <Pressable
                  key={value}
                  style={[styles.historyFilterChip, historyModeFilter === value && styles.historyFilterChipActive]}
                  onPress={() => setHistoryModeFilter(value)}
                >
                  <Text style={[styles.historyFilterChipText, historyModeFilter === value && styles.historyFilterChipTextActive]}>
                    {value === 'all' ? '全部' : MODE_LABELS[value]}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.historyResetBtn}
                onPress={() => {
                  void resetToday().then(() => {
                    setTodayRecord({ keys: [], draws: 0, fallback: false });
                    setLastDrawFallback(false);
                    void openDrawHistory();
                  });
                }}
              >
                <Text style={styles.historyResetBtnText}>重置今日</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {historyDays.length === 0 && (
                <Text style={styles.historyEmpty}>还没有抽歌记录</Text>
              )}
              {historyDays.map(day => {
                const modes = Object.entries(day.modes).filter(([modeKey]) => historyModeFilter === 'all' || modeKey === historyModeFilter);
                const hasAny = modes.some(([, record]) => record.keys.length > 0 || record.draws > 0);
                return (
                  <View key={day.date} style={styles.historyDay}>
                    <Text style={styles.historyDate}>{day.date}{day.date === localDateKey() ? ' · 今天' : ''}</Text>
                    {!hasAny && <Text style={styles.historyItem}>· （无记录）</Text>}
                    {modes.map(([modeKey, record]) => (
                      <View key={modeKey}>
                        <Text style={styles.historyModeLabel}>{MODE_LABELS[modeKey as DrawMode] || modeKey} · {record.draws} 次</Text>
                        {record.keys.map(key => {
                          const [musicType, songId, difficultyIndex] = key.split(':');
                          const music = rawData.find(item => item.id === songId && item.type === musicType);
                          return (
                            <Text key={key} style={styles.historyItem} numberOfLines={1}>
                              · {music ? music.title : songId} {DifficultyShortLabels[Number(difficultyIndex)] || ''}
                            </Text>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable style={styles.historyClose} onPress={() => setHistoryVisible(false)}>
              <Text style={styles.historyCloseText}>关闭</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  planToggle: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light,
  },
  planToggleText: { fontSize: 11.5, fontWeight: '800', color: Colors.text.secondary },
  planToggleTextActive: { color: Colors.accent.secondary },
  drawnHint: { fontSize: 10.5, color: Colors.text.muted, flex: 1, textAlign: 'right' },
  fallbackNotice: {
    position: 'absolute', bottom: 84, left: 16, right: 16,
    backgroundColor: 'rgba(25,25,34,0.95)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  fallbackNoticeText: { fontSize: 11, color: Colors.text.secondary, textAlign: 'center' },
  historyBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,8,16,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
    zIndex: 40, elevation: 40,
  },
  historyCard: {
    width: '100%', maxWidth: 340,
    backgroundColor: Colors.bg.secondary, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border.light,
    padding: 16, gap: 10,
  },
  historyTitle: { fontSize: 15, fontWeight: '900', color: Colors.text.primary },
  historyFilterRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  historyFilterChip: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7,
    backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.light,
  },
  historyFilterChipActive: { borderColor: Colors.accent.primary, backgroundColor: `${Colors.accent.primary}22` },
  historyFilterChipText: { fontSize: 10.5, fontWeight: '800', color: Colors.text.secondary },
  historyFilterChipTextActive: { color: Colors.accent.primary },
  historyResetBtn: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4 },
  historyResetBtnText: { fontSize: 10.5, fontWeight: '800', color: Colors.functional.danger },
  historyModeLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.text.muted, marginTop: 4 },
  historyList: { maxHeight: 340 },
  historyEmpty: { fontSize: 12, color: Colors.text.muted },
  historyDay: { marginBottom: 10 },
  historyDate: { fontSize: 11.5, fontWeight: '900', color: Colors.accent.secondary, marginBottom: 4 },
  historyItem: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
  historyClose: { backgroundColor: Colors.accent.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  historyCloseText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  modeBtnActive: {
    borderColor: Colors.accent.primary,
    backgroundColor: `${Colors.accent.primary}22`,
  },
  modeBtnText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: Colors.accent.primary,
  },
  notice: {
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: `${Colors.functional.warning}18`,
  },
  noticeText: {
    fontSize: 12,
    color: Colors.functional.warning,
    textAlign: 'center',
  },
  filterPanel: {
    maxHeight: 290,
    paddingHorizontal: 12,
  },
  searchInput: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandText: {
    fontSize: 11,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  collapsedHint: {
    fontSize: 11,
    color: Colors.text.muted,
    paddingVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginRight: 4,
    marginBottom: 4,
  },
  chipActive: {
    backgroundColor: `${Colors.accent.primary}33`,
    borderColor: Colors.accent.primary,
  },
  emptyVersionChip: {
    opacity: 0.72,
  },
  versionCount: {
    marginTop: 2,
    fontSize: 8,
    color: Colors.text.muted,
  },
  chipText: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  chipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  drumArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  filterToggle: {
    alignSelf: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterToggleText: {
    fontSize: 11,
    color: Colors.accent.secondary,
    fontWeight: '700',
  },
  placeholder: {
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  drawBtn: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: Colors.accent.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  drawBtnDisabled: {
    opacity: 0.4,
  },
  drawBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});