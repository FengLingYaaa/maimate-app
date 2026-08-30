/**
 * covers/full 原图 LRU（v1.16.8）： AsyncStorage 持久化 {uri: 最后使用毫秒}，
 * 超过 FULL_CACHE_LIMIT 张时删最久未用的文件。纯 async 模块级单例。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const LRU_KEY = 'maimate_cover_full_lru';
/** 原图缓存上限（张）。80 张 × ~300KB ≈ 最高 ~24MB。 */
const FULL_CACHE_LIMIT = 80;

type LruMap = Record<string, number>;

async function readLru(): Promise<LruMap> {
  try {
    const raw = await AsyncStorage.getItem(LRU_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed as LruMap;
  } catch {
    // 坏数据即重置。
  }
  return {};
}

async function writeLru(map: LruMap): Promise<void> {
  await AsyncStorage.setItem(LRU_KEY, JSON.stringify(map)).catch(() => undefined);
}

/** 登记一次使用（下载完成或命中时）。 */
export async function touchCoverFull(uri: string): Promise<void> {
  const map = await readLru();
  map[uri] = Date.now();
  await writeLru(map);
}

/** 超限淘汰：删除最久未用的原图文件，直到数量回到上限内。 */
export async function evictCoverFullIfNeeded(): Promise<void> {
  try {
    const map = await readLru();
    const entries = Object.entries(map);
    if (entries.length <= FULL_CACHE_LIMIT) return;
    entries.sort((left, right) => left[1] - right[1]);
    const victims = entries.slice(0, entries.length - FULL_CACHE_LIMIT);
    const next: LruMap = {};
    for (const [uri, time] of entries.slice(entries.length - FULL_CACHE_LIMIT)) next[uri] = time;
    for (const [uri] of victims) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
    await writeLru(next);
  } catch {
    // 淘汰失败不影响主流程。
  }
}

/** 统计（存储页明细/测试用）。 */
export async function getCoverFullStats(): Promise<{ count: number }> {
  const map = await readLru();
  return { count: Object.keys(map).length };
}

/** 清空 LRU 记录（清空曲绘缓存时调用）。 */
export async function clearCoverFullLru(): Promise<void> {
  await AsyncStorage.removeItem(LRU_KEY).catch(() => undefined);
}
