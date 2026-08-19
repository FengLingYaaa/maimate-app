/**
 * 随机抽歌页 — 推分计划、全曲库和按条件抽选。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicStore, usePlanStore } from '../src/store';
import { DrumRoll, RangeSlider } from '../src/components';
import { Colors, DifficultyColorMap, DifficultyLabels, MusicTypes } from '../src/constants';
import { getMatchingDifficultyIndices, MusicList } from '../src/data/music-list';
import { getVersionOptions } from '../src/data/version-catalog';
import type { DrawCandidate, FilterOptions } from '../src/data/types';

type DrawMode = 'plan' | 'any' | 'filtered';

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

  const [mode, setMode] = useState<DrawMode>('plan');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showVersions, setShowVersions] = useState(false);
  const [animationItems, setAnimationItems] = useState<DrawCandidate[]>([]);
  const [animationResultIndex, setAnimationResultIndex] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  const genres = useMemo(() => [...new Set(rawData.map(music => music.basic_info.genre))].sort(), [rawData]);
  const versionOptions = useMemo(() => getVersionOptions(rawData), [rawData]);
  const planCandidates = useMemo<DrawCandidate[]>(() => {
    const byChart = new Map(rawData.map(music => [`${music.type}:${music.id}`, music]));
    return planEntries
      .slice()
      .sort((left, right) => left.order - right.order)
      .flatMap(entry => {
        const music = byChart.get(`${entry.musicType || 'SD'}:${entry.songId}`) || rawData.find(item => item.id === entry.songId);
        if (!music || entry.difficultyIndex < 0 || entry.difficultyIndex >= music.charts.length) return [];
        return [{ music, difficultyIndex: entry.difficultyIndex, planEntry: entry }];
      });
  }, [planEntries, rawData]);

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

  const handleDraw = useCallback(() => {
    if (candidates.length === 0 || spinning) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
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
  }, [candidates, spinning]);

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

      {mode === 'plan' && planEntries.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>推分计划还是空的，请先在曲库中添加歌曲。</Text>
        </View>
      )}

      {mode === 'filtered' && (
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