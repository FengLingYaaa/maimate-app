import type { MusicData, SongAliasEntry } from './types';

/**
 * 独立别名层。当前不预置别名表，等待后续确认/提供高置信度数据。
 * 不修改 Diving-Fish 原始标题，也不将别名写回 music_data 缓存。
 */
export const CURATED_SONG_ALIASES: readonly SongAliasEntry[] = [];

function getEntry(music: MusicData): SongAliasEntry | undefined {
  return CURATED_SONG_ALIASES.find(entry =>
    entry.songId === music.id && (!entry.musicType || entry.musicType === music.type),
  );
}

export function getSongAliases(music: MusicData): string[] {
  return getEntry(music)?.aliases || [];
}

export function getSearchTitles(music: MusicData): string[] {
  return [music.title, music.basic_info.title, ...getSongAliases(music)]
    .map(value => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}
