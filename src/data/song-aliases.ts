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

/**
 * v1.19.0：本地自定义别名层（只存本机 AsyncStorage `maimate.custom-aliases.v1`，不写入 Yuzu 快照、不上传）。
 * 由 custom-aliases.ts 读写存储后通过 setCustomAliasMap() 注入；这里只保存内存副本。
 */
let customAliasMap: Record<string, string[]> = {};

export function setCustomAliasMap(map: Record<string, string[]>): void {
  customAliasMap = map;
  aliasVersion += 1;
}

export function getCustomAliasMap(): Record<string, string[]> {
  return customAliasMap;
}

/** 一首歌的自定义别名（原样顺序）。 */
export function getCustomAliases(music: Pick<MusicData, 'id'>): string[] {
  return customAliasMap[music.id] ?? [];
}

/** 文本是否为该曲的自定义别名（NFKC+小写比较）。 */
export function isCustomAlias(music: Pick<MusicData, 'id'>, text: string): boolean {
  return getCustomAliases(music).some(alias => sameText(alias, text));
}

function yuzuAliasesOf(music: MusicData): string[] {
  const list = activeLibrary.bySongId[music.id];
  if (!list || list.length === 0) return [];
  const titles = [music.title, music.basic_info?.title ?? ''];
  return list.filter(alias => alias.trim().length > 0 && !titles.some(title => sameText(title, alias)));
}

/**
 * 一首歌的别名（去掉与原标题相同的那一条）。
 * v1.19.0：自定义别名排在 Yuzu 别名之前（自定义优先），与 Yuzu 重复的只保留自定义那条。
 */
export function getSongAliases(music: MusicData): string[] {
  const custom = getCustomAliases(music);
  const yuzu = yuzuAliasesOf(music);
  if (custom.length === 0) return yuzu;
  return [...custom, ...yuzu.filter(alias => !custom.some(item => sameText(item, alias)))];
}

export interface AliasWithSource {
  text: string;
  source: 'custom' | 'yuzu';
}

/** v1.19.0：带来源的别名列表（详情页区分「自定义」与 Yuzu）。 */
export function getSongAliasEntries(music: MusicData): AliasWithSource[] {
  const custom = getCustomAliases(music);
  return [
    ...custom.map(text => ({ text, source: 'custom' as const })),
    ...yuzuAliasesOf(music).filter(alias => !custom.some(item => sameText(item, alias))).map(text => ({ text, source: 'yuzu' as const })),
  ];
}

/** 搜索用标题集合：官方标题 + 别名（顺序即优先级）。 */
export function getSearchTitles(music: MusicData): string[] {
  return [music.title, music.basic_info.title, ...getSongAliases(music)]
    .map(value => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}
