/**
 * DrumRoll — 与最终候选绑定的确定性滚筒动画。
 */

import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, DifficultyLabels, getCoverUrl } from '../constants';
import type { DrawCandidate } from '../data/types';

interface Props {
  items: DrawCandidate[];
  resultIndex: number | null;
  spinning: boolean;
  onSpinEnd?: () => void;
}

const SLOT_HEIGHT = 72;
const VISIBLE_SLOTS = 3;

export function DrumRoll({ items, resultIndex, spinning, onSpinEnd }: Props) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const result = resultIndex === null ? undefined : items[resultIndex];

  useEffect(() => {
    cancelAnimation(translateY);
    if (!spinning || resultIndex === null || items.length === 0) return;

    translateY.value = 0;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
    const targetY = -resultIndex * SLOT_HEIGHT;
    translateY.value = withTiming(
      targetY,
      {
        duration: Math.min(3600, Math.max(1500, 1200 + resultIndex * 85)),
        easing: Easing.out(Easing.cubic),
      },
      finished => {
        if (finished && onSpinEnd) runOnJS(onSpinEnd)();
      },
    );
  }, [items.length, resultIndex, spinning, onSpinEnd, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.window}>
        <View style={styles.highlightLine} />
        <Animated.View style={[styles.slotList, animatedStyle]}>
          {items.map((candidate, index) => {
            const { music, difficultyIndex } = candidate;
            return (
              <View key={`${music.id}-${difficultyIndex ?? 'song'}-${index}`} style={styles.slotItem}>
                <Image
                  source={{ uri: getCoverUrl(music.id) }}
                  style={styles.slotCover}
                  defaultSource={require('../../assets/icon.png')}
                />
                <View style={styles.slotInfo}>
                  <Text style={styles.slotTitle} numberOfLines={1}>{music.title}</Text>
                  <Text style={styles.slotArtist} numberOfLines={1}>
                    {difficultyIndex === undefined ? music.basic_info.artist : `${DifficultyLabels[difficultyIndex]} · ${music.basic_info.artist}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
        <View style={styles.topFade}>
          <Animated.View style={[styles.fadeGradient, overlayStyle]} />
        </View>
        <View style={styles.bottomFade}>
          <Animated.View style={[styles.fadeGradientBottom, overlayStyle]} />
        </View>
      </View>

      {!spinning && result && (
        <View style={styles.resultCard}>
          <Image
            source={{ uri: getCoverUrl(result.music.id) }}
            style={styles.resultCover}
            defaultSource={require('../../assets/icon.png')}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{result.music.title}</Text>
            <Text style={styles.resultArtist}>{result.music.basic_info.artist}</Text>
            <View style={styles.resultMeta}>
              <Text style={styles.resultMetaText}>{result.music.basic_info.genre}</Text>
              <Text style={styles.resultMetaText}> · {result.music.type}</Text>
              {result.difficultyIndex !== undefined && (
                <Text style={styles.resultMetaText}> · {DifficultyLabels[result.difficultyIndex]} {result.music.ds[result.difficultyIndex]}</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  window: {
    width: '90%',
    height: SLOT_HEIGHT * VISIBLE_SLOTS,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border.accent,
  },
  highlightLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.primary,
    zIndex: 10,
  },
  slotList: {
    paddingTop: SLOT_HEIGHT,
  },
  slotItem: {
    height: SLOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  slotCover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: Colors.bg.tertiary,
  },
  slotInfo: {
    flex: 1,
    gap: 2,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  slotArtist: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SLOT_HEIGHT / 2,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SLOT_HEIGHT / 2,
  },
  fadeGradient: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    opacity: 0.85,
  },
  fadeGradientBottom: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    opacity: 0.85,
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
});