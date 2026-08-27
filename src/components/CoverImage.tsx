import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { getCoverCandidates } from '../data/cover-resolver';
import { resolveCoverCacheUri } from '../data/cover-cache';
import type { MusicData } from '../data/types';

interface Props {
  music: MusicData;
  allSongs?: MusicData[];
  style: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

const PLACEHOLDER = require('../../assets/icon.png');

/**
 * 曲绘组件：候选顺序与 v1.10 一致；v1.11 起每个候选优先读本地缓存文件，
 * 未命中在后台下载落盘，下载完成前先直连远端显示，行为不劣于缓存前。
 */
export function CoverImage({ music, allSongs = [], style, accessibilityLabel }: Props) {
  const candidates = useMemo(() => getCoverCandidates(music, allSongs), [music, allSongs]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    setCandidateIndex(0);
    setCachedUri(null);
  }, [music.type, music.id, candidates.length]);

  const currentUrl = candidateIndex < candidates.length ? candidates[candidateIndex] : null;

  useEffect(() => {
    let cancelled = false;
    setCachedUri(null);
    if (!currentUrl) return undefined;
    resolveCoverCacheUri(music.id, currentUrl)
      .then(uri => {
        if (!cancelled && uri) setCachedUri(uri);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUrl, music.id]);

  const source = cachedUri
    ? { uri: cachedUri }
    : currentUrl
      ? { uri: currentUrl }
      : PLACEHOLDER;

  return (
    <Image
      source={source}
      style={style}
      defaultSource={PLACEHOLDER}
      onError={() => {
        setCandidateIndex(index => Math.min(index + 1, candidates.length));
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
