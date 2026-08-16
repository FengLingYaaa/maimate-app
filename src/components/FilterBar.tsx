/**
 * FilterBar — 多维筛选栏
 * 支持：分类/难度/等级/定数/版本/类型/曲师/谱师/BPM/标题
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import { Colors, DifficultyColorMap } from '../constants';
import { DifficultyLabels, Genres, MusicTypes } from '../constants/game';
import type { FilterOptions } from '../data/types';

interface Props {
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
  versions: string[];
}

export function FilterBar({ filters, onApply, onClear, totalCount, filteredCount, versions }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterOptions>({ ...filters });

  const hasActiveFilters = Object.values(filters).some(v => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  const toggleGenre = (genre: string) => {
    const current = localFilters.genre;
    if (current === undefined || current === genre) {
      setLocalFilters({ ...localFilters, genre: undefined });
    } else if (Array.isArray(current)) {
      if (current.includes(genre)) {
        const next = current.filter(g => g !== genre);
        setLocalFilters({ ...localFilters, genre: next.length > 0 ? next : undefined });
      } else {
        setLocalFilters({ ...localFilters, genre: [...current, genre] });
      }
    } else {
      setLocalFilters({ ...localFilters, genre: [genre] });
    }
  };

  const toggleDifficulty = (idx: number) => {
    const current = localFilters.difficulty;
    if (current === undefined) {
      setLocalFilters({ ...localFilters, difficulty: [idx] });
    } else if (Array.isArray(current)) {
      if (current.includes(idx)) {
        const next = current.filter(d => d !== idx);
        setLocalFilters({ ...localFilters, difficulty: next.length > 0 ? next : undefined });
      } else {
        setLocalFilters({ ...localFilters, difficulty: [...current, idx] });
      }
    } else if (current === idx) {
      setLocalFilters({ ...localFilters, difficulty: undefined });
    } else {
      setLocalFilters({ ...localFilters, difficulty: [current as number, idx] });
    }
  };

  const toggleType = (type: 'SD' | 'DX') => {
    const current = localFilters.type;
    if (current === undefined) {
      setLocalFilters({ ...localFilters, type });
    } else if (Array.isArray(current)) {
      if (current.includes(type)) {
        const next = current.filter(t => t !== type);
        setLocalFilters({ ...localFilters, type: next.length > 0 ? next as ('SD' | 'DX')[] : undefined });
      } else {
        setLocalFilters({ ...localFilters, type: [...current, type] });
      }
    } else if (current === type) {
      setLocalFilters({ ...localFilters, type: undefined });
    } else {
      setLocalFilters({ ...localFilters, type: [current as 'SD' | 'DX', type] });
    }
  };

  const applyAndClose = () => {
    onApply(localFilters);
    setShowModal(false);
  };

  const clearAll = () => {
    const empty = {};
    setLocalFilters(empty);
    onClear();
    setShowModal(false);
  };

  return (
    <View>
      {/* 顶部快速搜索栏 */}
      <View style={styles.quickBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索歌曲名..."
          placeholderTextColor={Colors.text.muted}
          value={localFilters.titleSearch || ''}
          onChangeText={text => {
            const next = { ...localFilters, titleSearch: text || undefined };
            setLocalFilters(next);
            onApply(next);
          }}
          onSubmitEditing={() => onApply(localFilters)}
        />
        <Pressable
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setShowModal(true)}
        >
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            筛选 {hasActiveFilters ? '●' : '○'}
          </Text>
        </Pressable>
      </View>

      {/* 结果计数 */}
      {hasActiveFilters && (
        <Text style={styles.countText}>
          {filteredCount} / {totalCount} 首
        </Text>
      )}

      {/* 筛选弹窗 */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>筛选条件</Text>
              <Pressable onPress={clearAll}>
                <Text style={styles.clearBtn}>清除全部</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 分类筛选 */}
              <Text style={styles.sectionTitle}>分类</Text>
              <View style={styles.chipRow}>
                {Genres.map(genre => {
                  const active = Array.isArray(localFilters.genre)
                    ? localFilters.genre.includes(genre)
                    : localFilters.genre === genre;
                  return (
                    <Pressable
                      key={genre}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleGenre(genre)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{genre}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 难度筛选 */}
              <Text style={styles.sectionTitle}>难度</Text>
              <View style={styles.chipRow}>
                {DifficultyLabels.map((label, i) => {
                  const active = Array.isArray(localFilters.difficulty)
                    ? localFilters.difficulty.includes(i)
                    : localFilters.difficulty === i;
                  return (
                    <Pressable
                      key={i}
                      style={[
                        styles.chip,
                        active && { backgroundColor: `${DifficultyColorMap[i]}33`, borderColor: DifficultyColorMap[i] },
                      ]}
                      onPress={() => toggleDifficulty(i)}
                    >
                      <Text style={[styles.chipText, active && { color: DifficultyColorMap[i] }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 类型筛选 */}
              <Text style={styles.sectionTitle}>类型</Text>
              <View style={styles.chipRow}>
                {MusicTypes.map(type => {
                  const active = Array.isArray(localFilters.type)
                    ? localFilters.type.includes(type)
                    : localFilters.type === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.chip,
                        active && { backgroundColor: type === 'DX' ? `${Colors.accent.secondary}33` : `${Colors.accent.primary}33` },
                      ]}
                      onPress={() => toggleType(type)}
                    >
                      <Text style={[
                        styles.chipText,
                        active && { color: type === 'DX' ? Colors.accent.secondary : Colors.accent.primary },
                      ]}>
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 版本筛选 */}
              <Text style={styles.sectionTitle}>版本</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
                {versions.map(ver => {
                  const active = Array.isArray(localFilters.version)
                    ? localFilters.version.includes(ver)
                    : localFilters.version === ver;
                  return (
                    <Pressable
                      key={ver}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        const current = localFilters.version;
                        if (current === undefined) {
                          setLocalFilters({ ...localFilters, version: ver });
                        } else if (Array.isArray(current)) {
                          if (current.includes(ver)) {
                            const next = current.filter(v => v !== ver);
                            setLocalFilters({ ...localFilters, version: next.length > 0 ? next : undefined });
                          } else {
                            setLocalFilters({ ...localFilters, version: [...current, ver] });
                          }
                        } else if (current === ver) {
                          setLocalFilters({ ...localFilters, version: undefined });
                        } else {
                          setLocalFilters({ ...localFilters, version: [current, ver] });
                        }
                      }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{ver}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.applyBtn} onPress={applyAndClose}>
                <Text style={styles.applyBtnText}>应用 ({filteredCount} 首)</Text>
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
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
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '60%',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    marginTop: 14,
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  chipActive: {
    backgroundColor: `${Colors.accent.primary}33`,
    borderColor: Colors.accent.primary,
  },
  chipText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  chipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '600',
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