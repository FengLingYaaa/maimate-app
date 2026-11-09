/**
 * 本地自定义别名（v1.19.0）。
 *
 * - 存储：AsyncStorage `maimate.custom-aliases.v1`，格式 { bySongId: { [songId]: string[] }, updatedAt }。
 * - 只在本机生效：不写入 Yuzu 快照（maimate.aliases.v1 / aliases-seed.json），不上传任何服务器。
 * - 搜索与 OCR 通过 song-aliases.ts 的 getSongAliases() 合并：自定义在前，优先于 Yuzu。
 * - 删除自定义别名后，该曲的搜索结果自然回到 Yuzu 原始结果。
 * - 跟随备份导入导出（备份可选字段 customAliases，旧备份没有该字段时保留本机数据）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MusicData } from './types';
import { getCustomAliasMap, getSongAliases, setCustomAliasMap } from './song-aliases';

export const CUSTOM_ALIAS_STORAGE_KEY = 'maimate.custom-aliases.v1';
export const CUSTOM_ALIAS_MAX_LENGTH = 40;
export const CUSTOM_ALIAS_MAX_PER_SONG = 50;
export const CUSTOM_ALIAS_MAX_SONGS = 5000;

export interface CustomAliasFile {
  bySongId: Record<string, string[]>;
  updatedAt?: string;
}

function fold(text: string): string {
  return text.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');
}

/** 规范化输入：NFKC、去首尾空白、多空格压成一个。 */
export function cleanAliasInput(text: string): string {
  return (text || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export type CustomAliasRejectReason = 'empty' | 'too-long' | 'same-as-title' | 'other-title' | 'duplicate';

export interface CustomAliasCheck {
  ok: boolean;
  alias: string;
  reason?: CustomAliasRejectReason;
  message?: string;
  /** 已经使用同一叫法（标题以外的别名）的其它歌曲，允许并列，仅提示。 */
  sharedWith: MusicData[];
}

/**
 * 校验一条自定义别名：
 * - 空 / 只有空格 → empty；超过 40 字 → too-long；
 * - 与本曲正式标题相同 → same-as-title；与任意其它曲的正式标题相同 → other-title（会污染精确匹配，拒绝）；
 * - 与本曲已有别名（自定义或 Yuzu）重复 → duplicate；
 * - 与其它歌曲的别名相同 → 允许，sharedWith 列出这些歌，由用户自己区分。
 */
export function checkCustomAlias(text: string, music: MusicData, allSongs: MusicData[]): CustomAliasCheck {
  const alias = cleanAliasInput(text);
  const fail = (reason: CustomAliasRejectReason, message: string): CustomAliasCheck => ({ ok: false, alias, reason, message, sharedWith: [] });
  if (!alias) return fail('empty', '别名不能为空');
  if (alias.length > CUSTOM_ALIAS_MAX_LENGTH) return fail('too-long', `别名最长 ${CUSTOM_ALIAS_MAX_LENGTH} 个字`);
  const key = fold(alias);
  if ([music.title, music.basic_info?.title ?? ''].some(title => title && fold(title) === key)) {
    return fail('same-as-title', '和这首歌的正式标题一样，不需要再加');
  }
  const otherTitle = allSongs.find(song => song.id !== music.id
    && [song.title, song.basic_info?.title ?? ''].some(title => title && fold(title) === key));
  if (otherTitle) return fail('other-title', `和另一首歌的正式标题「${otherTitle.title}」重复`);
  if (getSongAliases(music).some(existing => fold(existing) === key)) return fail('duplicate', '这首歌已经有这个别名了');
  const sharedWith = allSongs.filter(song => song.id !== music.id && getSongAliases(song).some(existing => fold(existing) === key));
  return { ok: true, alias, sharedWith };
}

/** 解析存储/备份里的自定义别名：逐条过滤空/超长，单曲与总量设上限；损坏返回空。 */
export function normalizeCustomAliasMap(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result: Record<string, string[]> = {};
  let songs = 0;
  for (const [songId, list] of Object.entries(input as Record<string, unknown>)) {
    if (songs >= CUSTOM_ALIAS_MAX_SONGS) break;
    if (!/^\d+$/.test(songId) || !Array.isArray(list)) continue;
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of list) {
      if (typeof item !== 'string') continue;
      const alias = cleanAliasInput(item);
      if (!alias || alias.length > CUSTOM_ALIAS_MAX_LENGTH) continue;
      const key = fold(alias);
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(alias);
      if (cleaned.length >= CUSTOM_ALIAS_MAX_PER_SONG) break;
    }
    if (cleaned.length > 0) {
      result[songId] = cleaned;
      songs += 1;
    }
  }
  return result;
}

export function parseCustomAliasFile(raw: string | null): CustomAliasFile {
  if (!raw) return { bySongId: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<CustomAliasFile>;
    return { bySongId: normalizeCustomAliasMap(parsed?.bySongId), updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : undefined };
  } catch {
    return { bySongId: {} };
  }
}

/** 纯函数：在 map 上新增一条（不改原对象）。 */
export function withAliasAdded(map: Record<string, string[]>, songId: string, alias: string): Record<string, string[]> {
  const current = map[songId] ?? [];
  if (current.some(item => fold(item) === fold(alias))) return map;
  return { ...map, [songId]: [...current, alias] };
}

/** 纯函数：删除一条（不改原对象）；删空后移除该曲键。 */
export function withAliasRemoved(map: Record<string, string[]>, songId: string, alias: string): Record<string, string[]> {
  const current = map[songId] ?? [];
  const next = current.filter(item => fold(item) !== fold(alias));
  if (next.length === current.length) return map;
  const copy = { ...map };
  if (next.length === 0) delete copy[songId];
  else copy[songId] = next;
  return copy;
}

export function countCustomAliases(map: Record<string, string[]>): number {
  return Object.values(map).reduce((sum, list) => sum + list.length, 0);
}

async function persist(map: Record<string, string[]>): Promise<void> {
  const file: CustomAliasFile = { bySongId: map, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(CUSTOM_ALIAS_STORAGE_KEY, JSON.stringify(file));
  setCustomAliasMap(map);
}

/** 启动时读取（app/_layout.tsx 调用）。 */
export async function loadCustomAliases(): Promise<Record<string, string[]>> {
  try {
    const file = parseCustomAliasFile(await AsyncStorage.getItem(CUSTOM_ALIAS_STORAGE_KEY));
    setCustomAliasMap(file.bySongId);
    return file.bySongId;
  } catch {
    return getCustomAliasMap();
  }
}

export async function addCustomAlias(songId: string, alias: string): Promise<void> {
  await persist(withAliasAdded(getCustomAliasMap(), songId, cleanAliasInput(alias)));
}

export async function removeCustomAlias(songId: string, alias: string): Promise<void> {
  await persist(withAliasRemoved(getCustomAliasMap(), songId, alias));
}

export async function clearCustomAliases(): Promise<void> {
  await AsyncStorage.removeItem(CUSTOM_ALIAS_STORAGE_KEY);
  setCustomAliasMap({});
}
