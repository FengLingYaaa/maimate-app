import type { MusicPlatform, SortMode } from './types';

export const MUSIC_PLATFORM_OPTIONS: Array<{ value: MusicPlatform; label: string }> = [
  { value: 'netease', label: '网易云音乐' },
  { value: 'qq', label: 'QQ 音乐' },
  { value: 'kugou', label: '酷狗音乐' },
];

export const SORT_OPTIONS: Array<{ mode: SortMode; label: string }> = [
  { mode: 'relevance', label: '搜索相关度' },
  { mode: 'titleAsc', label: '歌曲名 A → Z' },
  { mode: 'titleDesc', label: '歌曲名 Z → A' },
  { mode: 'constantAsc', label: '官方定数低 → 高' },
  { mode: 'constantDesc', label: '官方定数高 → 低' },
];

export function getSortLabel(mode: SortMode): string {
  return SORT_OPTIONS.find(option => option.mode === mode)?.label || '搜索相关度';
}
