/**
 * FilterBar — 曲库统一筛选栏。
 * 曲库和抽选页使用同一套 FilterOptions，避免两边规则不一致。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  artists: string[];
  charters: string[];
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
  artists,
  charters,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterOptions>({ ...filters });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    searchTimer.current = setTimeout(() => onApply(next), 180);
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

  const dsRange: [number, number] = localFilters.dsRange || [0, 15];
  const pendingCount = getPreviewCount ? getPreviewCount(cleanFilters(localFilters)) : filteredCount;

  return (
    <View>
      <View style={styles.quickBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="模糊搜索歌曲名、曲师或谱师..."
          placeholderTextColor={Colors.text.muted}
          value={localFilters.titleSearch || ''}
          onChangeText={handleSearchChange}
          onSubmitEditing={() => onApply(cleanFilters(localFilters))}
          returnKeyType="search"
        />
        {!!localFilters.titleSearch && (
          <Pressable style={styles.clearSearch} onPress={clearSearch}>
            <Text style={styles.clearSearchText}>×</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setShowModal(true)}
        >
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            筛选 {hasActiveFilters ? '●' : '○'}
          </Text>
        </Pressable>
      </View>

      {hasActiveFilters && (
        <Text style={styles.countText}>{filteredCount} / {totalCount} 首</Text>
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
                ].map(([mode, label]) => {
                  const active = localFilters.sort?.mode === mode || (!localFilters.sort && mode === 'relevance');
                  return (
                    <Pressable key={mode} style={[styles.chip, active && styles.chipActive]} onPress={() => setSortMode(mode as NonNullable<FilterOptions['sort']>['mode'])}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {(localFilters.sort?.mode === 'constantAsc' || localFilters.sort?.mode === 'constantDesc') && (
                <>
                  <Text style={styles.sortHint}>按官方定数排序使用的难度（列表会高亮该难度）</Text>
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
                <Text style={styles.sectionTitle}>版本</Text>
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
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  clearSearch: {
    position: 'absolute',
    right: 78,
    top: 16,
    zIndex: 2,
  },
  clearSearchText: {
    fontSize: 22,
    lineHeight: 22,
    color: Colors.text.muted,
  },
  filterBtn: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
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
  },
  countText: {
    fontSize: 11,
    color: Colors.text.muted,
    paddingHorizontal: 16,
    paddingBottom: 4,
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