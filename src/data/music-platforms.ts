import type { MusicPlatform } from './types';

export const MUSIC_PLATFORM_LABELS: Record<MusicPlatform, string> = {
  netease: '网易云音乐',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐',
};

function rawQuery(title: string, artist?: string): string {
  return [title, artist].filter(Boolean).join(' ').trim();
}

function encodeQuery(title: string, artist?: string): string {
  return encodeURIComponent(rawQuery(title, artist));
}

/** 用户需要复制到客户端搜索框的原始关键词（曲名 + 曲师）。 */
export function getMusicPlatformSearchText(title: string, artist?: string): string {
  return rawQuery(title, artist);
}

/** Stable HTTPS search pages used whenever the native client cannot handle a route. */
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

/**
 * Best-effort native search routes. These are undocumented client routes and
 * therefore always need the HTTPS fallback supplied by the caller.
 */
export function getMusicPlatformAppUrls(platform: MusicPlatform, title: string, artist?: string): string[] {
  const query = encodeURIComponent(rawQuery(title, artist));
  switch (platform) {
    case 'qq':
      return [
        `qqmusic://qq.com/ui/search?key=${query}`,
        `qqmusic://search?keyword=${query}`,
      ];
    case 'kugou':
      return [
        `kugou://search?keyword=${query}`,
        `kugou://search/song?keyword=${query}`,
      ];
    case 'netease':
    default:
      return [
        `orpheus://search?keyword=${query}`,
        `orpheus://search?query=${query}`,
        `orpheus://nm/search?keyword=${query}`,
        `orpheus://search/m/?s=${query}&type=1`,
      ];
  }
}
