/**
 * DrumRoll — 顺时针曲绘滚筒，候选会多次切换，最后停在真实抽中歌曲。
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants';
import { CoverImage } from './CoverImage';
import type { DrawCandidate, MusicData } from '../data/types';

interface Props {
  items: DrawCandidate[];
  resultIndex: number | null;
  spinning: boolean;
  onSpinEnd?: () => void;
  onResultPress?: (candidate: DrawCandidate) => void;
  allSongs?: MusicData[];
}

const COVER_SIZE = 104;
const SIDE_COVER_SIZE = 54;

export function DrumRoll({ items, resultIndex, spinning, onSpinEnd, onResultPress, allSongs = [] }: Props) {
  const rotation = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const finishRef = useRef<(() => void) | null>(null);
  const spinGenerationRef = useRef(0);
  const result = resultIndex === null ? undefined : items[resultIndex];
  const active = items[activeIndex] || result;
  const previous = items[Math.max(0, activeIndex - 1)] || active;
  const next = items[Math.min(items.length - 1, activeIndex + 1)] || active;

  useEffect(() => {
    const generation = spinGenerationRef.current + 1;
    spinGenerationRef.current = generation;
    finishRef.current = null;
    cancelAnimation(rotation);

    if (!spinning || resultIndex === null || items.length === 0) {
      if (!spinning && resultIndex !== null) setActiveIndex(resultIndex);
      return () => {
        if (spinGenerationRef.current === generation) finishRef.current = null;
      };
    }

    setActiveIndex(0);
    rotation.value = 0;
    let currentIndex = 0;
    let switchTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      currentIndex = Math.min(currentIndex + 1, resultIndex);
      setActiveIndex(currentIndex);
    }, 82);
    let didFinish = false;

    const finish = () => {
      if (didFinish || spinGenerationRef.current !== generation) return;
      didFinish = true;
      if (switchTimer) {
        clearInterval(switchTimer);
        switchTimer = null;
      }
      cancelAnimation(rotation);
      rotation.value = Math.PI * 2 * 6;
      setActiveIndex(resultIndex);
      finishRef.current = null;
      onSpinEnd?.();
    };

    finishRef.current = finish;
    rotation.value = withTiming(Math.PI * 2 * 6, {
      duration: Math.min(4600, Math.max(2800, 2500 + resultIndex * 48)),
      easing: Easing.out(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(finish)();
    });

    return () => {
      if (switchTimer) clearInterval(switchTimer);
      switchTimer = null;
      cancelAnimation(rotation);
      if (spinGenerationRef.current === generation) finishRef.current = null;
    };
  }, [items.length, resultIndex, spinning, onSpinEnd, rotation]);

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}rad` }],
  }));

  const handleStop = () => {
    finishRef.current?.();
  };

  if (!active) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.carousel, pressed && spinning && styles.carouselPressed]}
        onPress={spinning ? handleStop : undefined}
        disabled={!spinning}
        accessibilityRole={spinning ? 'button' : undefined}
        accessibilityLabel={spinning ? '点击停止抽选' : undefined}
      >
        <View style={styles.orbit} />
        <CoverImage music={previous.music} allSongs={allSongs} style={[styles.sideCover, styles.leftCover]} />
        <Animated.View style={[styles.mainCoverFrame, rotatingStyle]}>
          <CoverImage music={active.music} allSongs={allSongs} style={styles.mainCover} />
        </Animated.View>
        <CoverImage music={next.music} allSongs={allSongs} style={[styles.sideCover, styles.rightCover]} />
        <Text style={styles.switchLabel}>{spinning ? '旋转中…点击此处停止' : '抽选完成'}</Text>
      </Pressable>

      {!spinning && result && (
        <Pressable
          style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}
          onPress={() => onResultPress?.(result)}
          disabled={!onResultPress}
          accessibilityRole={onResultPress ? 'button' : undefined}
          accessibilityLabel="查看歌曲详情"
        >
          <CoverImage music={result.music} allSongs={allSongs} style={styles.resultCover} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{result.music.title}</Text>
            <Text style={styles.resultArtist}>{result.music.basic_info.artist}</Text>
            <View style={styles.resultMeta}>
              <Text style={styles.resultMetaText}>{result.music.basic_info.genre}</Text>
              <Text style={styles.resultMetaText}> · {result.music.type}</Text>
            </View>
            {onResultPress && <Text style={styles.detailHint}>点击查看歌曲详情</Text>}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  carousel: {
    width: '94%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  carouselPressed: {
    opacity: 0.88,
  },
  orbit: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 2,
    borderColor: Colors.border.accent,
    opacity: 0.65,
  },
  mainCoverFrame: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 18,
    padding: 4,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 2,
    borderColor: Colors.accent.primary,
    zIndex: 2,
  },
  mainCover: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  sideCover: {
    position: 'absolute',
    zIndex: 1,
    width: SIDE_COVER_SIZE,
    height: SIDE_COVER_SIZE,
    borderRadius: 10,
    opacity: 0.62,
    backgroundColor: Colors.bg.tertiary,
  },
  leftCover: {
    left: '16%',
    transform: [{ rotateZ: '-18deg' }],
  },
  rightCover: {
    right: '16%',
    transform: [{ rotateZ: '18deg' }],
  },
  switchLabel: {
    position: 'absolute',
    bottom: 8,
    fontSize: 12,
    color: Colors.text.muted,
  },
  resultCard: {
    width: '90%',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  resultCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  resultCover: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.bg.primary,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  resultArtist: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  resultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  resultMetaText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  detailHint: {
    fontSize: 11,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
});
