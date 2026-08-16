/**
 * DrumRoll — 滚筒旋转抽歌动画
 * 模拟 MaimaiDX 洗衣机滚筒转动，停下展示抽中歌曲
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../constants';
import { getCoverUrl } from '../constants/game';
import type { MusicData } from '../data/types';

interface Props {
  songs: MusicData[];           // 参与抽选的歌曲列表
  resultIndex: number | null;   // 抽中结果索引（null = 未开始/动画中）
  spinning: boolean;            // 是否正在旋转
  onSpinEnd?: () => void;       // 旋转结束回调
}

const SLOT_HEIGHT = 72;
const VISIBLE_SLOTS = 3;

export function DrumRoll({ songs, resultIndex, spinning, onSpinEnd }: Props) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const spinCount = useRef(0);

  useEffect(() => {
    if (spinning && songs.length > 0) {
      // 开始旋转动画：快速上下滚动
      opacity.value = withTiming(1, { duration: 300 });
      runSpinAnimation();
    }
  }, [spinning]);

  useEffect(() => {
    if (!spinning && resultIndex !== null && songs.length > 0) {
      // 停止：定位到结果
      const targetY = -resultIndex * SLOT_HEIGHT + SLOT_HEIGHT * Math.floor(VISIBLE_SLOTS / 2);
      translateY.value = withTiming(targetY, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });

      if (onSpinEnd) {
        setTimeout(onSpinEnd, 900);
      }
    }
  }, [spinning, resultIndex]);

  const runSpinAnimation = () => {
    if (!spinning) return;

    const steps = 20;
    const stepHeight = SLOT_HEIGHT;
    let currentStep = 0;

    const doStep = () => {
      if (!spinning) return;
      currentStep++;
      const target = -((currentStep * stepHeight) % (songs.length * SLOT_HEIGHT));
      translateY.value = withTiming(target, {
        duration: 60,
        easing: Easing.linear,
      });

      if (currentStep < steps) {
        setTimeout(doStep, 50);
      } else {
        // 减速阶段
        const slowSteps = 8;
        const doSlow = (i: number) => {
          if (!spinning || i >= slowSteps) return;
          const slowTarget = target - Math.random() * SLOT_HEIGHT * 0.5;
          translateY.value = withTiming(slowTarget, {
            duration: 100 + i * 30,
            easing: Easing.out(Easing.quad),
          });
          setTimeout(() => doSlow(i + 1), 120 + i * 30);
        };
        setTimeout(() => doSlow(0), 60);
      }
    };

    doStep();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* 滚筒窗口 */}
      <View style={styles.window}>
        {/* 中心高亮指示线 */}
        <View style={styles.highlightLine} />

        <Animated.View style={[styles.slotList, animatedStyle]}>
          {songs.map((song, i) => (
            <View key={`${song.id}-${i}`} style={styles.slotItem}>
              <Image
                source={{ uri: getCoverUrl(song.id) }}
                style={styles.slotCover}
                defaultSource={require('../../assets/icon.png')}
              />
              <View style={styles.slotInfo}>
                <Text style={styles.slotTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.slotArtist} numberOfLines={1}>{song.basic_info.artist}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* 顶部/底部渐变遮罩 */}
        <View style={styles.topFade}>
          <Animated.View style={[styles.fadeGradient, overlayStyle]} />
        </View>
        <View style={styles.bottomFade}>
          <Animated.View style={[styles.fadeGradientBottom, overlayStyle]} />
        </View>
      </View>

      {/* 结果展示区 */}
      {!spinning && resultIndex !== null && songs[resultIndex] && (
        <Animated.View style={[styles.resultCard]}>
          <Image
            source={{ uri: getCoverUrl(songs[resultIndex].id) }}
            style={styles.resultCover}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{songs[resultIndex].title}</Text>
            <Text style={styles.resultArtist}>{songs[resultIndex].basic_info.artist}</Text>
            <View style={styles.resultMeta}>
              <Text style={styles.resultMetaText}>{songs[resultIndex].basic_info.genre}</Text>
              <Text style={styles.resultMetaText}> · BPM {songs[resultIndex].basic_info.bpm}</Text>
              <Text style={styles.resultMetaText}> · {songs[resultIndex].type}</Text>
            </View>
          </View>
        </Animated.View>
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
    paddingTop: SLOT_HEIGHT * Math.floor(VISIBLE_SLOTS / 2),
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