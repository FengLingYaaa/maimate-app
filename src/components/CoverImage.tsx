import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { getCoverCandidates } from '../data/cover-resolver';
import { resolveCoverCacheUri, resolveCoverCacheUriBlocking } from '../data/cover-cache';
import type { MusicData } from '../data/types';

interface Props {
  music: MusicData;
  allSongs?: MusicData[];
  style: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  /** v1.16.8：详情页等大图场景传 true，优先加载原图（列表默认走缩略图）。 */
  preferFull?: boolean;
}

const PLACEHOLDER = require('../../assets/icon.png');

/**
 * 曲绘组件：v1.16.8 起本地优先——本地缓存未就绪前只显示占位图，绝不直连远端，
 * 避免每张曲绘都被系统图片库按远端 URL 再缓存一份（其它缓存虚高的根因）。
 * 缓存命中由 resolveCoverCacheUri 后台下载，落盘完成后自动切换到本地文件。
 */
export function CoverImage({ music, allSongs = [], style, accessibilityLabel, preferFull = false }: Props) {
  const candidates = useMemo(() => getCoverCandidates(music, allSongs), [music, allSongs]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    setCandidateIndex(0);
    setLocalUri(null);
  }, [music.type, music.id, candidates.length]);

  const currentUrl = candidateIndex < candidates.length ? candidates[candidateIndex] : null;

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    if (!currentUrl) return undefined;
    // preferFull（详情页）先等原图；列表先等缩略图，原图下载不阻塞列表显示。
    const loader = preferFull ? resolveCoverCacheUri(music.id, currentUrl) : resolveCoverCacheUriBlocking(music.id, currentUrl);
    loader
      .then(uri => {
        if (!cancelled && uri) setLocalUri(uri);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUrl, music.id, preferFull]);

  if (!localUri) {
    return <Image source={PLACEHOLDER} style={style} accessibilityLabel={accessibilityLabel} />;
  }
  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      onError={() => {
        // 本地文件异常时切换下一个候选 URL 重新解析。
        setLocalUri(null);
        setCandidateIndex(index => Math.min(index + 1, candidates.length));
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
