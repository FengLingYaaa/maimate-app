/**
 * b23.tv 短链解析与缓存。
 *
 * 解析结果按原始链接缓存在会话内存中：同一链接第二次打开零延迟；
 * App 冷启动后首次打开需重新解析一次（约几百毫秒）。刻意不做
 * AsyncStorage 持久化，保持本模块不依赖 react-native，便于回归脚本直测。
 */

import { extractBilibiliVideoId, isBilibiliShortLink, resolveBilibiliShortLink } from './bilibili-search';

const resolutionCache = new Map<string, string | null>();

/** 取已缓存的解析结果（未解析过返回 undefined）。 */
export function getCachedResolvedUrl(url: string): string | null | undefined {
  return resolutionCache.get(url);
}

/** 同步取可用视频 ID：已缓存的长链直接提取；短链必须先 resolveAndCacheVideoUrl。 */
export function getCachedVideoAppUrl(url: string): string | null {
  const cached = resolutionCache.get(url);
  if (cached === undefined) return getDirectVideoAppUrl(url);
  if (cached === null) return null;
  const id = extractBilibiliVideoId(cached);
  return id ? `bilibili://video/${id}` : null;
}

/** 非短链的直提深链（长链本地映射，不走网络）。 */
export function getDirectVideoAppUrl(url: string): string | null {
  if (isBilibiliShortLink(url)) return null;
  const id = extractBilibiliVideoId(url);
  return id ? `bilibili://video/${id}` : null;
}

/**
 * 解析并缓存短链的最终地址；失败缓存 null 避免重复网络等待。
 * 返回可用于深链构建的最终地址（原样返回非短链输入）。
 */
export async function resolveAndCacheVideoUrl(url: string): Promise<string | null> {
  if (!isBilibiliShortLink(url)) return url.startsWith('http') ? url : null;
  const cached = resolutionCache.get(url);
  if (cached !== undefined) return cached;
  const finalUrl = await resolveBilibiliShortLink(url);
  const usable = finalUrl !== null && extractBilibiliVideoId(finalUrl) !== null ? finalUrl : null;
  resolutionCache.set(url, usable);
  return usable;
}
