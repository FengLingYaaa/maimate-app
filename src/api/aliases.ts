/**
 * Yuzu 别名库（v1.18.0）
 *
 * 数据来源：https://www.yuzuchan.moe/api/maimaidx/maimaidxalias
 * （文档里的旧域名 api.yuzuchan.moe 当前返回 403，这里用 www 域名）。
 *
 * - 内置快照随构建打包（src/data/aliases-seed.json），离线可用。
 * - 手动刷新的结果单独存 AsyncStorage `maimate.aliases.v1`，不覆盖内置快照；
 *   重装后该 key 清空，自动回退内置快照。
 * - 刷新失败时保留上次缓存（或内置快照），由调用方提示用户。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setRuntimeAliases, type AliasLibrary } from '../data/song-aliases';

export const ALIAS_API_URL = 'https://www.yuzuchan.moe/api/maimaidx/maimaidxalias';
export const ALIAS_STORAGE_KEY = 'maimate.aliases.v1';
const FETCH_TIMEOUT_MS = 20_000;

interface YuzuAliasItem {
  SongID: number | string;
  Name?: string;
  Alias?: unknown;
}

/** 把 Yuzu 原始响应转换为 { bySongId, updatedAt }；格式不对时抛错。纯函数，供回归脚本复用。 */
export function parseYuzuAliasResponse(payload: unknown, now: Date = new Date()): AliasLibrary {
  if (!payload || typeof payload !== 'object') throw new Error('别名库响应不是 JSON 对象');
  const body = payload as { code?: unknown; status_code?: unknown; content?: unknown };
  const okCode = body.code === 0 || body.code === undefined || body.status_code === 200;
  if (!okCode || !Array.isArray(body.content)) throw new Error('别名库响应格式不正确');
  const bySongId: Record<string, string[]> = {};
  for (const raw of body.content as YuzuAliasItem[]) {
    if (!raw || (typeof raw.SongID !== 'number' && typeof raw.SongID !== 'string')) continue;
    // Yuzu SongID 与 Diving-Fish music.id 相同（DX 已含 +10000），不做换算。
    const songId = String(raw.SongID).trim();
    if (!songId || !Array.isArray(raw.Alias)) continue;
    const seen = new Set<string>();
    const aliases: string[] = [];
    for (const alias of raw.Alias) {
      if (typeof alias !== 'string') continue;
      const value = alias.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      aliases.push(value);
    }
    if (aliases.length > 0) bySongId[songId] = aliases;
  }
  if (Object.keys(bySongId).length === 0) throw new Error('别名库为空');
  return { bySongId, updatedAt: now.toISOString() };
}

function isAliasLibrary(value: unknown): value is AliasLibrary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AliasLibrary>;
  return typeof candidate.updatedAt === 'string'
    && !!candidate.bySongId
    && typeof candidate.bySongId === 'object'
    && Object.values(candidate.bySongId).every(list => Array.isArray(list));
}

/** 启动时读取上次刷新的别名库；没有或损坏时保持内置快照。 */
export async function loadStoredAliases(): Promise<AliasLibrary | null> {
  try {
    const raw = await AsyncStorage.getItem(ALIAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isAliasLibrary(parsed)) return null;
    setRuntimeAliases(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** 手动刷新：拉取最新别名库，成功后存入 AsyncStorage 并立即生效；失败抛错，旧数据不动。 */
export async function refreshAliasLibrary(fetchImpl: typeof fetch = fetch): Promise<AliasLibrary> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const response = await fetchImpl(ALIAS_API_URL, { signal: controller?.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`别名库请求失败（HTTP ${response.status}）`);
    const library = parseYuzuAliasResponse(await response.json());
    await AsyncStorage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(library));
    setRuntimeAliases(library);
    return library;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
