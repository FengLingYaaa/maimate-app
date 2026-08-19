import type { BilibiliVideoLink } from './types';

export const BILIBILI_QUICK_TAGS = ['手元', '邪道', '研究', 'AP', 'FC'] as const;

export function getChartKey(songId: string, musicType: 'SD' | 'DX', difficultyIndex: number): string {
  return `${musicType}:${songId}:${difficultyIndex}`;
}

export function getBilibiliLinkChartKey(link: Pick<BilibiliVideoLink, 'songId' | 'musicType' | 'difficultyIndex'>): string {
  return getChartKey(link.songId, link.musicType, link.difficultyIndex);
}

export function normalizeBilibiliVideoUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLocaleLowerCase();
    const isBilibili = hostname === 'b23.tv'
      || hostname === 'bilibili.com'
      || hostname.endsWith('.bilibili.com');
    if (!isBilibili || url.protocol !== 'https:') return null;
    if (hostname !== 'b23.tv' && !/^\/(video|BV|av)/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getNewBilibiliLinkId(): string {
  return `bili-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
