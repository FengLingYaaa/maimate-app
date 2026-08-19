import type { MusicPlatform } from './types';

export const MUSIC_PLATFORM_LABELS: Record<MusicPlatform, string> = {
  netease: '网易云音乐',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐',
};

function encodeQuery(title: string, artist?: string): string {
  return encodeURIComponent([title, artist].filter(Boolean).join(' ').trim());
}

/** Stable HTTPS search pages; native private schemes are intentionally not used. */
export function getMusicPlatformSearchUrl(platform: MusicPlatform, title: string, artist?: string): string {
  const query = encodeQuery(title, artist);
  switch (platform) {
    case 'qq':
      return `https://y.qq.com/n/ryqq_v2/search?w=${query}&t=song`;
    case 'kugou':
      return `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${query}`;
    case 'netease':
    default:
      return `https://music.163.com/#/search/m/?s=${query}&type=1`;
  }
}
