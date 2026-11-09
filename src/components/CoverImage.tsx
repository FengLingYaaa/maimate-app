import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { getCoverCandidates } from '../data/cover-resolver';
import { resolveCoverCacheUriFull, resolveCoverCacheUriBlocking } from '../data/cover-cache';
import { resolveCoverChain } from '../data/cover-chain';
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
 * 缓存命中由缩略图/原图缓存解析器后台下载，落盘完成后自动切换到本地文件。
 */
export function CoverImage({ music, allSongs = [], style, accessibilityLabel, preferFull = false }: Props) {
  const candidates = useMemo(() => getCoverCandidates(music, allSongs), [music, allSongs]);
  // v1.18.0：startIndex 是候选链的起点（只在本地文件 onError 时推进）；
  // resolvedIndexRef 记录本轮链实际命中的候选，onError 时从它的下一个继续。
  const [startIndex, setStartIndex] = useState(0);
  const resolvedIndexRef = useRef(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  // 以内容作依赖，避免 allSongs 引用变化导致重复解析（与原先按 currentUrl 字符串依赖等价）。
  const candidatesKey = candidates.join('\n');

  useEffect(() => {
    setStartIndex(0);
    resolvedIndexRef.current = 0;
    setLocalUri(null);
  }, [music.type, music.id, candidatesKey]);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    if (startIndex >= candidates.length) return undefined;
    // preferFull（详情页）先等原图；列表先等缩略图，原图下载不阻塞列表显示。
    const resolveOne = (url: string) => (preferFull
      ? resolveCoverCacheUriFull(music.id, url).then(uri => uri ?? resolveCoverCacheUriBlocking(music.id, url))
      : resolveCoverCacheUriBlocking(music.id, url));
    // 下载失败（resolver 返回 null 或抛错）时继续下一个候选：Diving-Fish 全部失败后走到备用源。
    resolveCoverChain(candidates, startIndex, resolveOne, () => cancelled)
      .then(result => {
        if (cancelled) return;
        resolvedIndexRef.current = result.index;
        if (result.uri) setLocalUri(result.uri);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // candidates 由 candidatesKey 代表。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesKey, music.id, preferFull, startIndex]);

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
        setStartIndex(Math.min(resolvedIndexRef.current + 1, candidates.length));
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
