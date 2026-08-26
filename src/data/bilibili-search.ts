/**
 * Bilibili 外部搜索链接。
 *
 * MaiMate 不抓取视频、不内置视频目录；这里只根据本地歌曲标题和当前谱面
 * 难度生成客户端深链与网页搜索回退地址。单条用户主动保存的视频元数据
 * 由 bilibili-metadata.ts 另行按需缓存。
 */

import { bv2av } from './bilibili-bvid';

export type BilibiliDifficultyIndex = 2 | 3 | 4;

/** b23.tv 短链域名：需要先网络解析成最终视频地址才能提取 BV/av。 */
export const BILIBILI_SHORT_LINK_HOSTS = new Set(['b23.tv', 'www.b23.tv']);

export function isBilibiliSearchDifficulty(index: number): index is BilibiliDifficultyIndex {
  return index === 2 || index === 3 || index === 4;
}

export function getBilibiliSearchQuery(title: string, difficultyLabel: string): string {
  return `${title} ${difficultyLabel} maimai`;
}

export function getBilibiliSearchUrl(title: string, difficultyLabel: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(getBilibiliSearchQuery(title, difficultyLabel))}`;
}

/**
 * Bilibili Android 客户端的搜索深链。
 * openURL 失败时必须回退到 getBilibiliSearchUrl，不能阻塞详情页。
 */
export function getBilibiliAppSearchUrl(title: string, difficultyLabel: string): string {
  return `bilibili://search?keyword=${encodeURIComponent(getBilibiliSearchQuery(title, difficultyLabel))}`;
}

/**
 * 判断是否为 b23.tv 短链（打开前需要先解析成最终地址）。
 */
export function isBilibiliShortLink(url: string): boolean {
  try {
    return BILIBILI_SHORT_LINK_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * 从任意形态的 B 站视频地址提取视频 ID（BV… / av…）。
 * 覆盖：www/wwwm/mobile 主站 /video/<id>、查询参数 bvid=/avid=、
 * 以及纯 av 数字文本；提取不到返回 null（调用方走回退）。
 */
export function extractBilibiliVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/(?:video\/)?(BV[0-9A-Za-z]{10}|av\d+)/i);
    if (pathMatch) return pathMatch[1];
    for (const key of ['bvid', 'avid', 'aid']) {
      const value = parsed.searchParams.get(key);
      if (value) {
        if (/^BV[0-9A-Za-z]{10}$/i.test(value)) return `BV${value.slice(2)}`;
        if (/^\d+$/.test(value)) return `av${value}`;
      }
    }
  } catch {
    // 非 http(s) 结构时按无深链处理
  }
  return null;
}

/**
 * 从用户保存的视频链接生成 B 站客户端深链候选列表（按兼容面排序）。
 * BV 号会本地转成 av 号后优先使用 bilibili://video/<av>（客户端路由
 * 对数字 av 的兼容面更广），BV 形式作为次级候选；纯 av 链接直接给出。
 * b23.tv 短链需先用 resolveBilibiliShortLink() 解析成最终地址后再传入。
 */
export function getBilibiliVideoAppUrls(url: string): string[] {
  if (isBilibiliShortLink(url)) return [];
  const id = extractBilibiliVideoId(url);
  if (!id) return [];
  const candidates: string[] = [];
  if (/^BV/i.test(id)) {
    const aid = bv2av(id);
    if (aid !== null) candidates.push(`bilibili://video/${aid}`);
    candidates.push(`bilibili://video/${id}`);
  } else {
    candidates.push(`bilibili://video/${id}`);
  }
  return candidates;
}

/** 取首选深链（av 优先），无可提取 ID 返回 null。 */
export function getBilibiliVideoAppUrl(url: string): string | null {
  return getBilibiliVideoAppUrls(url)[0] ?? null;
}

/**
 * 把 b23.tv 短链解析成最终视频地址（跟随 302，不下载页面内容）。
 * 网络失败或超时返回 null；调用方必须保留网页回退路径。
 */
export async function resolveBilibiliShortLink(
  url: string,
  timeoutMs = 5000,
): Promise<string | null> {
  if (!isBilibiliShortLink(url)) return url.startsWith('http') ? url : null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const finalUrl = response.url || '';
    if (!finalUrl || extractBilibiliVideoId(finalUrl) === null) return null;
    return finalUrl;
  } catch {
    return null;
  }
}
