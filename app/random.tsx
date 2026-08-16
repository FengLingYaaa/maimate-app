/**
 * 随机抽歌页 — 滚筒旋转动画抽选
 * 支持按难度/分类/等级筛选后随机抽选
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useMusicStore } from '../src/store';
import { DrumRoll } from '../src/components';
import { DifficultyBadge } from '../src/components/DifficultyBadge';
import { Colors } from '../src/constants';
import { DifficultyLabels, Genres, MusicTypes } from '../src/constants/game';
import { MusicList } from '../src/data/music-list';
import type { FilterOptions, MusicData } from '../src/data/types';

type DrawMode = 'any' | 'filtered';

export default function RandomPicker() {
  const rawData = useMusicStore(s => s.rawData);

  const [mode, setMode] = useState<DrawMode>('any');
  const [selectedDiffs, setSelectedDiffs] = useState<number[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [selectedType, setSelectedType] = useState<'SD' | 'DX' | undefined>();
  const [result, setResult] = useState<MusicData | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // 参与抽选的歌曲池
  const songPool = useMemo(() => {
    let list = new MusicList(rawData);

    if (mode === 'filtered') {
      const opts: FilterOptions = {};
      if (selectedDiffs.length > 0) opts.difficulty = selectedDiffs;
      if (selectedGenre) opts.genre = selectedGenre;
      if (selectedType) opts.type = selectedType;
      list = list.filter(opts);
    }

    return list;
  }, [rawData, mode, selectedDiffs, selectedGenre, selectedType]);

  const songArray = useMemo(() => songPool.all(), [songPool]);

  const handleDraw = useCallback(() => {
    if (songArray.length === 0) return;
    setResult(null);
    setSpinning(true);

    // 随机选结果，2秒后展示
    const pick = Math.floor(Math.random() * songArray.length);
    setTimeout(() => {
      setResult(songArray[pick]);
      setSpinning(false);
    }, 2000);
  }, [songArray]);

  const toggleDiff = (idx: number) => {
    setSelectedDiffs(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎲 随机抽歌</Text>
        <Text style={styles.headerSub}>
          {mode === 'filtered' && songPool.length !== rawData.length
            ? `候选池: ${songPool.length} 首`
            : `全曲库: ${rawData.length} 首`}
        </Text>
      </View>

      {/* 模式切换 */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'any' && styles.modeBtnActive]}
          onPress={() => setMode('any')}
        >
          <Text style={[styles.modeBtnText, mode === 'any' && styles.modeBtnTextActive]}>
            全曲随机
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'filtered' && styles.modeBtnActive]}
          onPress={() => { setMode('filtered'); setShowFilters(true); }}
        >
          <Text style={[styles.modeBtnText, mode === 'filtered' && styles.modeBtnTextActive]}>
            按条件抽选
          </Text>
        </Pressable>
      </View>

      {/* 筛选条件（filtered 模式） */}
      {mode === 'filtered' && showFilters && (
        <ScrollView style={styles.filterPanel} horizontal={false}>
          {/* 难度 */}
          <Text style={styles.filterLabel}>难度</Text>
          <View style={styles.chipRow}>
            {DifficultyLabels.map((label, i) => (
              <Pressable
                key={i}
                style={[styles.chip, selectedDiffs.includes(i) && styles.chipActive]}
                onPress={() => toggleDiff(i)}
              >
                <Text style={[styles.chipText, selectedDiffs.includes(i) && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 分类 */}
          <Text style={styles.filterLabel}>分类</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, !selectedGenre && styles.chipActive]}
              onPress={() => setSelectedGenre(undefined)}
            >
              <Text style={[styles.chipText, !selectedGenre && styles.chipTextActive]}>全部</Text>
            </Pressable>
            {Genres.map(g => (
              <Pressable
                key={g}
                style={[styles.chip, selectedGenre === g && styles.chipActive]}
                onPress={() => setSelectedGenre(selectedGenre === g ? undefined : g)}
              >
                <Text style={[styles.chipText, selectedGenre === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>

          {/* 类型 */}
          <Text style={styles.filterLabel}>类型</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, !selectedType && styles.chipActive]}
              onPress={() => setSelectedType(undefined)}
            >
              <Text style={[styles.chipText, !selectedType && styles.chipTextActive]}>全部</Text>
            </Pressable>
            {MusicTypes.map(t => (
              <Pressable
                key={t}
                style={[styles.chip, selectedType === t && styles.chipActive]}
                onPress={() => setSelectedType(selectedType === t ? undefined : t)}
              >
                <Text style={[styles.chipText, selectedType === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* 滚筒动画 + 结果 */}
      <View style={styles.drumArea}>
        {spinning ? (
          <DrumRoll
            songs={songArray.slice(0, 50)}
            resultIndex={null}
            spinning={true}
          />
        ) : result ? (
          <DrumRoll
            songs={[result]}
            resultIndex={0}
            spinning={false}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🎰</Text>
            <Text style={styles.placeholderText}>
              {songArray.length === 0 ? '没有符合条件的歌曲' : '点击下方按钮开始抽选'}
            </Text>
          </View>
        )}
      </View>

      {/* 抽选按钮 */}
      <Pressable
        style={[styles.drawBtn, (spinning || songArray.length === 0) && styles.drawBtnDisabled]}
        onPress={handleDraw}
        disabled={spinning || songArray.length === 0}
      >
        <Text style={styles.drawBtnText}>
          {spinning ? '🌀 旋转中...' : `🎰 抽一首 (${songArray.length}首候选)`}
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
    gap: 8,
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
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: Colors.accent.primary,
  },
  filterPanel: {
    maxHeight: 200,
    paddingHorizontal: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 4,
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
  },
  chipActive: {
    backgroundColor: `${Colors.accent.primary}33`,
    borderColor: Colors.accent.primary,
  },
  chipText: {
    fontSize: 11,
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
  placeholderIcon: {
    fontSize: 64,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
});