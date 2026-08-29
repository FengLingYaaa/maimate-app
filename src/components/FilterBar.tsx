/**
 * FilterBar — 曲库统一筛选栏。
 * 曲库和抽选页使用同一套 FilterOptions，避免两边规则不一致。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { DifficultyLabels, MusicTypes } from '../constants/game';
import { normalizeSearchText } from '../data/music-list';
import type { FilterOptions, VersionOption } from '../data/types';
import { RangeSlider } from './RangeSlider';

interface Props {
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
  getPreviewCount?: (filters: FilterOptions) => number;
  genres: string[];
  versionOptions: VersionOption[];
  chinaVersionOptions?: VersionOption[];
  artists: string[];
  charters: string[];
  /** 搜索历史存储分键（v1.16.1）：'library' | 'plan'，默认 'library'。 */
  historyKey?: 'library' | 'plan';
}

function cleanFilters(input: FilterOptions): FilterOptions {
  const next: FilterOptions = { ...input };
  for (const key of ['titleSearch', 'artist', 'charter'] as const) {
    if (next[key] !== undefined && next[key]!.trim() === '') next[key] = undefined;
  }
  if (next.dsRange && next.dsRange[0] <= 0 && next.dsRange[1] >= 15) {
    next.dsRange = undefined;
  }
  return next;
}

function toggleValue<T extends string | number>(
  current: T | T[] | undefined,
  value: T,
): T | T[] | undefined {
  if (current === undefined) return value;
  const values = Array.isArray(current) ? [...current] : [current];
  if (values.includes(value)) {
    const next = values.filter(item => item !== value);
    return next.length > 0 ? next : undefined;
  }
  return [...values, value];
}

export function FilterBar({
  filters,
  onApply,
  onClear,
  totalCount,
  filteredCount,
  getPreviewCount,
  genres,
  versionOptions,
  chinaVersionOptions = [],
  artists,
  charters,
  /** v1.16.1：搜索历史分键——不同页面独立记忆（如 'library' / 'plan'）。 */
  historyKey = 'library',
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterOptions>({ ...filters });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // v1.15.2：曲库搜索历史（最近 5 条，本机 AsyncStorage 持久化）。
  // v1.16.1：按 historyKey 分键存储，曲库与计划互不干扰；旧版共享 key 的数据迁给曲库。
  const HISTORY_LIMIT = 5;
  const historyStorageKey = historyKey === 'plan' ? 'maimate_search_history:plan' : 'maimate_search_history:library';
  const legacyHistoryKey = 'maimate_search_history';
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const HISTORY_KEY = historyStorageKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // v1.16.1：旧版共享 key 的历史迁给曲库（新键为空时），避免用户丢记录。
        let raw = await AsyncStorage.getItem(historyStorageKey);
        if (raw === null) {
          raw = await AsyncStorage.getItem(legacyHistoryKey);
          if (raw !== null && historyStorageKey === 'maimate_search_history:library') {
            AsyncStorage.setItem(historyStorageKey, raw).catch(() => undefined);
          }
        }
        const parsed = raw ? JSON.parse(raw) : [];
        if (!cancelled && Array.isArray(parsed)) {
          setSearchHistory(parsed.filter(item => typeof item === 'string').slice(0, HISTORY_LIMIT));
        }
      } catch {
        // 忽略坏数据。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyStorageKey, legacyHistoryKey]);

  const recordSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory(previous => {
      const next = [trimmed, ...previous.filter(item => item !== trimmed)].slice(0, HISTORY_LIMIT);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const removeSearchHistory = useCallback((query: string) => {
    setSearchHistory(previous => {
      const next = previous.filter(item => item !== query);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    setLocalFilters({ ...filters });
  }, [filters]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const hasActiveFilters = Object.values(filters).some(value => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  const artistSuggestions = useMemo(() => {
    const query = normalizeSearchText(localFilters.artist || '');
    if (!query) return [];
    return artists
      .filter(artist => normalizeSearchText(artist).includes(query))
      .slice(0, 8);
  }, [artists, localFilters.artist]);

  const charterSuggestions = useMemo(() => {
    const query = normalizeSearchText(localFilters.charter || '');
    if (!query) return [];
    return charters
      .filter(charter => normalizeSearchText(charter).includes(query))
      .slice(0, 8);
  }, [charters, localFilters.charter]);

  const update = (next: FilterOptions) => setLocalFilters(next);

  const toggleGenre = (genre: string) => {
    update({ ...localFilters, genre: toggleValue(localFilters.genre, genre) as FilterOptions['genre'] });
  };

  const toggleDifficulty = (index: number) => {
    update({ ...localFilters, difficulty: toggleValue(localFilters.difficulty, index) as FilterOptions['difficulty'] });
  };

  const toggleType = (type: 'SD' | 'DX') => {
    update({ ...localFilters, type: toggleValue(localFilters.type, type) as FilterOptions['type'] });
  };

  const toggleVersion = (version: string) => {
    update({ ...localFilters, version: toggleValue(localFilters.version, version) as FilterOptions['version'] });
  };

  const toggleChinaVersion = (version: string) => {
    update({ ...localFilters, chinaVersion: toggleValue(localFilters.chinaVersion, version) as FilterOptions['chinaVersion'] });
  };

  const setText = (key: 'artist' | 'charter', value: string) => {
    update({ ...localFilters, [key]: value || undefined });
  };

  const setSortMode = (mode: NonNullable<FilterOptions['sort']>['mode']) => {
    const difficultyIndex = localFilters.sort?.difficultyIndex
      ?? (typeof localFilters.difficulty === 'number' ? localFilters.difficulty : 3);
    update({
      ...localFilters,
      sort: mode === 'constantAsc' || mode === 'constantDesc'
        ? { mode, difficultyIndex }
        : { mode },
    });
  };

  const setSortDifficulty = (difficultyIndex: number) => {
    update({ ...localFilters, sort: { mode: localFilters.sort?.mode || 'constantDesc', difficultyIndex } });
  };

  const handleSearchChange = (text: string) => {
    const next = cleanFilters({ ...localFilters, titleSearch: text || undefined });
    setLocalFilters(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onApply(next);
      // v1.15.2：防抖结束后记录有效搜索词（≥2 字符才记，避免单字符噪音）。
      if (text.trim().length >= 2) recordSearch(text);
    }, 180);
  };

  const clearSearch = () => {
    const next = { ...localFilters, titleSearch: undefined };
    setLocalFilters(next);
    onApply(cleanFilters(next));
  };

  const applyAndClose = () => {
    onApply(cleanFilters(localFilters));
    setShowModal(false);
  };

  const clearAll = () => {
    setLocalFilters({});
    onClear();
    setShowModal(false);
  };

  /** 清除全部筛选但不关闭弹层（活动筛选条上的入口）。 */
  const clearAllInPlace = () => {
    setLocalFilters({});
    onClear();
  };

  const dsRange: [number, number] = localFilters.dsRange || [0, 15];
  const pendingCount = getPreviewCount ? getPreviewCount(cleanFilters(localFilters)) : filteredCount;

  // 摘要条的移除操作要立即生效：基于「已应用的 filters」打补丁并 onApply。
  const localFiltersRef = useRef(localFilters);
  useEffect(() => { localFiltersRef.current = localFilters; }, [localFilters]);
  const applyPatch = useCallback((patch: Partial<FilterOptions>) => {
    const next = cleanFilters({ ...filters, ...patch });
    setLocalFilters(next);
    onApply(next);
  }, [filters, onApply]);
  const removeFromList = useCallback((key: 'genre' | 'difficulty' | 'version' | 'chinaVersion' | 'type', value: string | number) => {
    const current = filters[key];
    if (current === undefined) return;
    const list = Array.isArray(current) ? current.filter(item => item !== value) : [];
    applyPatch({ [key]: list.length > 0 ? list : undefined } as unknown as Partial<FilterOptions>);
  }, [applyPatch, filters]);

  /** 活动筛选摘要条目；每项可单独移除。 */
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; color?: string; onRemove: () => void }> = [];

    if (filters.titleSearch?.trim()) {
      chips.push({ key: 'q', label: `🔍 ${filters.titleSearch.trim()}`, onRemove: () => applyPatch({ titleSearch: undefined }) });
    }
    const each = <T,>(value: unknown, fn: (item: T) => void) => {
      const list = (Array.isArray(value) ? value : value !== undefined ? [value] : []) as T[];
      list.forEach(fn);
    };
    each<string>(filters.genre, item => chips.push({
      key: `g:${item}`, label: item, onRemove: () => removeFromList('genre', item),
    }));
    each<number>(filters.difficulty, index => chips.push({
      key: `d:${index}`,
      label: DifficultyLabels[index] || `难度${index}`,
      color: DifficultyColorMap[index],
      onRemove: () => removeFromList('difficulty', index),
    }));
    each<string>(filters.version, item => chips.push({
      key: `v:${item}`, label: item, onRemove: () => removeFromList('version', item),
    }));
    each<string>(filters.chinaVersion, item => chips.push({
      key: `c:${item}`, label: item, onRemove: () => removeFromList('chinaVersion', item),
    }));
    each<string>(filters.type, item => chips.push({
      key: `t:${item}`, label: item, onRemove: () => removeFromList('type', item),
    }));
    if (filters.dsRange && !(filters.dsRange[0] <= 0 && filters.dsRange[1] >= 15)) {
      chips.push({ key: 'ds', label: `定数 ${filters.dsRange[0]}–${filters.dsRange[1]}`, onRemove: () => applyPatch({ dsRange: undefined }) });
    }
    if (filters.artist?.trim()) {
      chips.push({ key: 'ar', label: `曲师 ${filters.artist.trim()}`, onRemove: () => applyPatch({ artist: undefined }) });
    }
    if (filters.charter?.trim()) {
      chips.push({ key: 'ch', label: `谱师 ${filters.charter.trim()}`, onRemove: () => applyPatch({ charter: undefined }) });
    }
    if (filters.sort && filters.sort.mode !== 'relevance') {
      const labels: Record<string, string> = {
        titleAsc: 'A→Z', titleDesc: 'Z→A', constantAsc: '定数↑', constantDesc: '定数↓',
        fitAsc: '拟合定数↑', fitDesc: '拟合定数↓',
      };
      chips.push({
        key: 'sort',
        label: `排序 ${labels[filters.sort.mode] || filters.sort.mode}`,
        onRemove: () => applyPatch({ sort: undefined }),
      });
    }
    return chips;
  }, [applyPatch, filters, removeFromList]);

  return (
    <View>
      <View style={styles.quickBar}>
        <View style={styles.searchField}>
          <TextInput
            style={styles.searchInput}
            placeholder="模糊搜索歌曲名、曲师或谱师..."
            placeholderTextColor={Colors.text.muted}
            value={localFilters.titleSearch || ''}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => {
              onApply(cleanFilters(localFilters));
              if ((localFilters.titleSearch || '').trim().length >= 2) recordSearch(localFilters.titleSearch!);
            }}
            returnKeyType="search"
          />
          {!!localFilters.titleSearch && (
            <Pressable style={styles.clearSearch} onPress={clearSearch} hitSlop={6} accessibilityLabel="清空搜索">
              <Text style={styles.clearSearchText}>×</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setShowModal(true)}
        >
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            筛选{hasActiveFilters ? ` · ${activeChips.length}` : ''}
          </Text>
        </Pressable>
      </View>

      {/* v1.15.2：搜索历史（最近 5 条，点击复用；输入时自动隐藏）。 */}
      {searchHistory.length > 0 && !localFilters.titleSearch && (
        <View style={styles.historyRow}>
          <Text style={styles.historyLabel}>最近</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyContent}>
            {searchHistory.map(item => (
              <Pressable
                key={item}
                style={styles.historyChip}
                onPress={() => {
                  const next = cleanFilters({ ...localFilters, titleSearch: item });
                  setLocalFilters(next);
                  onApply(next);
                }}
                onLongPress={() => removeSearchHistory(item)}
                delayLongPress={350}
                accessibilityLabel={`长按删除搜索记录 ${item}`}
              >
                <Text style={styles.historyChipText} numberOfLines={1}>🔍 {item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {(activeChips.length > 0 || filteredCount !== totalCount) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeRow} contentContainerStyle={styles.activeRowContent}>
          <Text style={styles.countText}>{filteredCount}/{totalCount} 首</Text>
          {activeChips.map(chip => (
            <Pressable key={chip.key} style={[styles.activeChip, chip.color ? { borderColor: `${chip.color}88`, backgroundColor: `${chip.color}1f` } : null]} onPress={chip.onRemove}>
              <Text style={[styles.activeChipText, chip.color ? { color: chip.color } : null]} numberOfLines={1}>{chip.label}</Text>
              <Text style={[styles.activeChipClose, chip.color ? { color: chip.color } : null]}>×</Text>
            </Pressable>
          ))}
          {activeChips.length > 1 && (
            <Pressable style={styles.activeChipAll} onPress={clearAllInPlace}>
              <Text style={styles.activeChipAllText}>全部清除</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>筛选条件</Text>
              <Pressable onPress={clearAll}>
                <Text style={styles.clearBtn}>清除全部</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionTitle}>排序</Text>
              <View style={styles.chipRow}>
                {[
                  ['relevance', '相关度'],
                  ['titleAsc', '歌曲名 A→Z'],
                  ['titleDesc', '歌曲名 Z→A'],
                  ['constantAsc', '定数低→高'],
                  ['constantDesc', '定数高→低'],
                  ['fitAsc', '拟合定数低→高'],
                  ['fitDesc', '拟合定数高→低'],
                ].map(([mode, label]) => {
                  const active = localFilters.sort?.mode === mode || (!localFilters.sort && mode === 'relevance');
                  return (
                    <Pressable key={mode} style={[styles.chip, active && styles.chipActive]} onPress={() => setSortMode(mode as NonNullable<FilterOptions['sort']>['mode'])}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {(localFilters.sort?.mode === 'constantAsc' || localFilters.sort?.mode === 'constantDesc'
                || localFilters.sort?.mode === 'fitAsc' || localFilters.sort?.mode === 'fitDesc') && (
                <>
                  <Text style={styles.sortHint}>
                    {localFilters.sort?.mode === 'fitAsc' || localFilters.sort?.mode === 'fitDesc'
                      ? '按拟合定数排序使用的难度（无拟合数据的谱面排在末尾）'
                      : '按官方定数排序使用的难度（列表会高亮该难度）'}
                  </Text>
                  <View style={styles.chipRow}>
                    {DifficultyLabels.map((label, index) => {
                      const active = localFilters.sort?.difficultyIndex === index;
                      return (
                        <Pressable key={index} style={[styles.chip, active && { backgroundColor: `${DifficultyColorMap[index]}33`, borderColor: DifficultyColorMap[index] }]} onPress={() => setSortDifficulty(index)}>
                          <Text style={[styles.chipText, active && { color: DifficultyColorMap[index] }]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>分类</Text>
              <View style={styles.chipRow}>
                {genres.map(genre => {
                  const active = Array.isArray(localFilters.genre)
                    ? localFilters.genre.includes(genre)
                    : localFilters.genre === genre;
                  return (
                    <Pressable key={genre} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleGenre(genre)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>难度颜色</Text>
              <View style={styles.chipRow}>
                {DifficultyLabels.map((label, index) => {
                  const active = Array.isArray(localFilters.difficulty)
                    ? localFilters.difficulty.includes(index)
                    : localFilters.difficulty === index;
                  return (
                    <Pressable
                      key={index}
                      style={[styles.chip, active && { backgroundColor: `${DifficultyColorMap[index]}33`, borderColor: DifficultyColorMap[index] }]}
                      onPress={() => toggleDifficulty(index)}
                    >
                      <Text style={[styles.chipText, active && { color: DifficultyColorMap[index] }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>官方定数</Text>
              <RangeSlider
                value={dsRange}
                onChange={range => update({ ...localFilters, dsRange: range[0] <= 0 && range[1] >= 15 ? undefined : range })}
              />

              <Text style={styles.sectionTitle}>类型</Text>
              <View style={styles.chipRow}>
                {MusicTypes.map(type => {
                  const active = Array.isArray(localFilters.type)
                    ? localFilters.type.includes(type)
                    : localFilters.type === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.chip, active && { backgroundColor: `${type === 'DX' ? Colors.accent.secondary : Colors.accent.primary}33`, borderColor: type === 'DX' ? Colors.accent.secondary : Colors.accent.primary }]}
                      onPress={() => toggleType(type)}
                    >
                      <Text style={[styles.chipText, active && { color: type === 'DX' ? Colors.accent.secondary : Colors.accent.primary }]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.expandHeader}>
                <Text style={styles.sectionTitle}>日服 / 原始版本</Text>
                <Pressable onPress={() => setShowVersions(value => !value)}>
                  <Text style={styles.expandText}>{showVersions ? '收起' : `展开全部（${versionOptions.length}）`}</Text>
                </Pressable>
              </View>
              {showVersions ? (
                <View style={styles.chipRow}>
                  {versionOptions.map(option => {
                    const active = Array.isArray(localFilters.version)
                      ? localFilters.version.includes(option.rawValue)
                      : localFilters.version === option.rawValue;
                    return (
                      <Pressable key={option.rawValue} style={[styles.chip, active && styles.chipActive, option.count === 0 && styles.emptyVersionChip]} onPress={() => toggleVersion(option.rawValue)}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                        <Text style={[styles.versionCount, active && styles.chipTextActive]}>{option.count === 0 ? '暂无' : option.count}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.collapsedHint}>
                  {Array.isArray(localFilters.version) ? `${localFilters.version.length} 个版本已选择` : localFilters.version || '未选择版本'}
                </Text>
              )}

              {chinaVersionOptions.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>中国区版本</Text>
                  <View style={styles.chipRow}>
                    {chinaVersionOptions.map(option => {
                      const active = Array.isArray(localFilters.chinaVersion)
                        ? localFilters.chinaVersion.includes(option.rawValue)
                        : localFilters.chinaVersion === option.rawValue;
                      return (
                        <Pressable key={option.rawValue} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleChinaVersion(option.rawValue)}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                          <Text style={[styles.versionCount, active && styles.chipTextActive]}>{option.count || '暂无'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>曲师</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="输入曲师关键词"
                placeholderTextColor={Colors.text.muted}
                value={localFilters.artist || ''}
                onChangeText={value => setText('artist', value)}
              />
              {artistSuggestions.length > 0 && (
                <View style={styles.suggestionRow}>
                  {artistSuggestions.map(artist => (
                    <Pressable key={artist} style={styles.suggestion} onPress={() => setText('artist', artist)}>
                      <Text style={styles.suggestionText}>{artist}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.sectionTitle}>谱师</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="输入谱师关键词"
                placeholderTextColor={Colors.text.muted}
                value={localFilters.charter || ''}
                onChangeText={value => setText('charter', value)}
              />
              {charterSuggestions.length > 0 && (
                <View style={styles.suggestionRow}>
                  {charterSuggestions.map(charter => (
                    <Pressable key={charter} style={styles.suggestion} onPress={() => setText('charter', charter)}>
                      <Text style={styles.suggestionText}>{charter}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.applyBtn} onPress={applyAndClose}>
                <Text style={styles.applyBtnText}>应用（待筛选 {pendingCount} 首）</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  // 搜索框与清除键包在同一个容器内：清除键悬浮在输入框内部右侧，
  // 不再与「筛选」按钮重叠（v1.7.0 布局修复）。
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 36,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  clearSearch: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    zIndex: 2,
  },
  clearSearchText: {
    fontSize: 20,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6, gap: 6 },
  historyLabel: { fontSize: 11, color: Colors.text.muted, fontWeight: '700' },
  historyContent: { gap: 6, alignItems: 'center' },
  historyChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.light,
    maxWidth: 160,
  },
  historyChipText: { fontSize: 11, color: Colors.text.secondary },
  filterBtn: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterBtnActive: {
    borderColor: Colors.accent.primary,
    backgroundColor: `${Colors.accent.primary}22`,
  },
  filterBtnText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  filterBtnTextActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  activeRow: {
    flexGrow: 0,
  },
  activeRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  countText: {
    fontSize: 11,
    color: Colors.text.muted,
    marginRight: 2,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 220,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.bg.secondary,
  },
  activeChipText: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  activeChipClose: {
    fontSize: 13,
    lineHeight: 14,
    color: Colors.text.muted,
  },
  activeChipAll: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: `${Colors.functional.danger}1f`,
    borderWidth: 1,
    borderColor: `${Colors.functional.danger}66`,
  },
  activeChipAllText: {
    fontSize: 10,
    color: Colors.functional.danger,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '86%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  clearBtn: {
    fontSize: 14,
    color: Colors.functional.danger,
  },
  modalBody: {
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginTop: 14,
    marginBottom: 8,
  },
  sortHint: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.text.muted,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scrollRow: {
    marginBottom: 8,
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
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginRight: 6,
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
    fontSize: 9,
    color: Colors.text.muted,
  },
  chipText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  chipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  suggestion: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: `${Colors.accent.secondary}22`,
  },
  suggestionText: {
    fontSize: 10,
    color: Colors.accent.secondary,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  applyBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});