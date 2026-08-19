import type { BilibiliVideoLink } from './types';

export const BILIBILI_QUICK_TAGS = ['手元', '邪道', '研究', 'AP', 'FC'] as const;

export interface ParsedBilibiliShare {
  url: string;
  title?: string;
  rawText: string;
}

export function getChartKey(songId: string, musicType: 'SD' | 'DX', difficultyIndex: number): string {
  return `${musicType}:${songId}:${difficultyIndex}`;
}

export function getBilibiliLinkChartKey(link: Pick<BilibiliVideoLink, 'songId' | 'musicType' | 'difficultyIndex'>): string {
  return getChartKey(link.songId, link.musicType, link.difficultyIndex);
}

function cleanTitle(value: string): string | undefined {
  const title = value
    .trim()
    .replace(/^[\s【\[「『]+/, '')
    .replace(/[\s】\]」』]+$/, '')
    .replace(/\s*[-—–]\s*哔哩哔哩\s*$/i, '')
    .trim();
  return title || undefined;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[\s>》】）)\]}]+$/g, '');
}

/** Extract a Bilibili URL and the human-readable title from a copied share card. */
export function parseBilibiliShare(value: string): ParsedBilibiliShare | null {
  const rawText = value.trim();
  if (!rawText) return null;
  const match = rawText.match(/https?:\/\/(?:b23\.tv|(?:www\.)?bilibili\.com)\/[^\s<>"']+/i);
  if (!match || match.index === undefined) return null;
  const url = normalizeBilibiliVideoUrl(stripTrailingPunctuation(match[0]));
  if (!url) return null;
  const title = cleanTitle(rawText.slice(0, match.index));
  return { url, title, rawText };
}

export function normalizeBilibiliVideoUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  const parsed = input.match(/https?:\/\/(?:b23\.tv|(?:www\.)?bilibili\.com)\/[^\s<>"']+/i);
  const candidate = stripTrailingPunctuation(parsed?.[0] || input);
  try {
    const url = new URL(candidate);
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
