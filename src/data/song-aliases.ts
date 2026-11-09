import type { MusicData, SongAliasEntry } from './types';
import aliasSeed from './aliases-seed.json';

/**
 * 独立别名层（v1.18.0 起接入 Yuzu 别名库）。
 *
 * - 内置快照：`aliases-seed.json`，构建时打包，离线、首装即可用。
 *   来源 https://www.yuzuchan.moe/api/maimaidx/maimaidxalias，全部收录，不按票数过滤。
 * - 运行时覆盖：设置里手动刷新得到的别名库存在 AsyncStorage（maimate.aliases.v1），
 *   启动时读入并通过 `setRuntimeAliases()` 覆盖内置快照；重装后 AsyncStorage 清空，
 *   自然回退到内置快照。两份数据分开存，互不覆盖。
 * - Yuzu SongID 与 Diving-Fish music.id 相同（DX 已含 +10000），直接用 id 查，不做换算。
 * - 不修改 Diving-Fish 原始标题，也不把别名写回 music_data 缓存。
 */

export interface AliasLibrary {
  bySongId: Record<string, string[]>;
  updatedAt: string;
}

interface AliasSeedFile extends AliasLibrary {
  source?: string;
}

const SEED = aliasSeed as AliasSeedFile;

export const BUNDLED_ALIAS_LIBRARY: AliasLibrary = {
  bySongId: SEED.bySongId,
  updatedAt: SEED.updatedAt,
};

/** 内置快照的全部别名条目（每首一条，不按票数过滤）。 */
export const CURATED_SONG_ALIASES: readonly SongAliasEntry[] = Object.entries(SEED.bySongId).map(
  ([songId, aliases]) => ({ songId, aliases, source: 'curated' as const }),
);

let activeLibrary: AliasLibrary = BUNDLED_ALIAS_LIBRARY;
let activeSource: 'bundled' | 'refreshed' = 'bundled';
/** 别名数据版本号：每次替换别名库 +1，供搜索字段缓存判断是否失效。 */
let aliasVersion = 0;

/** 用刷新得到的别名库覆盖内置快照（传 null 回退内置）。 */
export function setRuntimeAliases(library: AliasLibrary | null): void {
  activeLibrary = library ?? BUNDLED_ALIAS_LIBRARY;
  activeSource = library ? 'refreshed' : 'bundled';
  aliasVersion += 1;
}

export function getAliasVersion(): number {
  return aliasVersion;
}

export function getActiveAliasLibraryInfo(): { source: 'bundled' | 'refreshed'; updatedAt: string; songCount: number; aliasCount: number } {
  const lists = Object.values(activeLibrary.bySongId);
  return {
    source: activeSource,
    updatedAt: activeLibrary.updatedAt,
    songCount: lists.length,
    aliasCount: lists.reduce((sum, list) => sum + list.length, 0),
  };
}

function sameText(left: string, right: string): boolean {
  return left.trim().normalize('NFKC').toLocaleLowerCase() === right.trim().normalize('NFKC').toLocaleLowerCase();
}

/** 一首歌的别名（去掉与原标题相同的那一条）。 */
export function getSongAliases(music: MusicData): string[] {
  const list = activeLibrary.bySongId[music.id];
  if (!list || list.length === 0) return [];
  const titles = [music.title, music.basic_info?.title ?? ''];
  return list.filter(alias => alias.trim().length > 0 && !titles.some(title => sameText(title, alias)));
}

/** 搜索用标题集合：官方标题 + 别名（顺序即优先级）。 */
export function getSearchTitles(music: MusicData): string[] {
  return [music.title, music.basic_info.title, ...getSongAliases(music)]
    .map(value => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}
