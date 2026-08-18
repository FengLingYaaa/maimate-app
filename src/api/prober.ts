/**
 * Prober API 客户端
 * 数据来源: Diving-Fish 舞萌DX查分器 (MIT License)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MusicData } from '../data/types';
import { CACHE_KEYS, CACHE_MAX_AGE_MS, PROBER_API_BASE } from '../constants/game';

const MUSIC_DATA_URL = `${PROBER_API_BASE}/music_data`;

export interface MusicDataCacheResult {
  data: MusicData[];
  cacheTimestamp: number | null;
  fromCache: boolean;
  stale: boolean;
  backgroundRefresh: Promise<MusicData[]> | null;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function isStale(timestamp: number | null): boolean {
  return timestamp === null || Date.now() - timestamp >= CACHE_MAX_AGE_MS;
}

/** 拉取全量曲目数据 */
export async function fetchMusicData(): Promise<MusicData[]> {
  const response = await fetch(MUSIC_DATA_URL);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data: MusicData[] = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('API returned empty or invalid data');
  }

  return data;
}

async function readCachedMusicData(): Promise<{
  data: MusicData[];
  cacheTimestamp: number | null;
} | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.musicData);
    if (!cached) return null;

    const parsed: unknown = JSON.parse(cached);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    let timestampValue: string | null = null;
    try {
      timestampValue = await AsyncStorage.getItem(CACHE_KEYS.musicDataVersion);
    } catch {
      // 缺少时间戳时按过期缓存处理，但缓存内容仍然可用。
    }

    return {
      data: parsed as MusicData[],
      cacheTimestamp: parseTimestamp(timestampValue),
    };
  } catch {
    // 缓存损坏或存储不可用时，继续网络请求。
    return null;
  }
}

async function writeMusicDataCache(data: MusicData[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.musicData, JSON.stringify(data));
    await AsyncStorage.setItem(CACHE_KEYS.musicDataVersion, Date.now().toString());
  } catch {
    // 网络数据仍然可用，缓存写入失败不应使本次请求失败。
  }
}

/** 拉取网络数据并更新本地缓存。 */
export async function refreshMusicData(): Promise<MusicData[]> {
  const data = await fetchMusicData();
  await writeMusicDataCache(data);
  return data;
}

/**
 * 获取曲库及缓存状态。
 * 过期缓存会先返回，并同时启动一个可观察的后台刷新 Promise。
 */
export async function getMusicDataWithStatus(forceRefresh = false): Promise<MusicDataCacheResult> {
  if (forceRefresh) {
    const data = await refreshMusicData();
    return {
      data,
      cacheTimestamp: await getCacheTimestamp(),
      fromCache: false,
      stale: false,
      backgroundRefresh: null,
    };
  }

  const cached = await readCachedMusicData();
  if (!cached) {
    const data = await refreshMusicData();
    return {
      data,
      cacheTimestamp: await getCacheTimestamp(),
      fromCache: false,
      stale: false,
      backgroundRefresh: null,
    };
  }

  const stale = isStale(cached.cacheTimestamp);
  const backgroundRefresh = stale ? refreshMusicData() : null;
  // 调用方可以继续观察并处理这个 Promise，同时避免无人观察时产生 unhandled rejection。
  backgroundRefresh?.catch(() => undefined);

  return {
    data: cached.data,
    cacheTimestamp: cached.cacheTimestamp,
    fromCache: true,
    stale,
    backgroundRefresh,
  };
}

/** 带本地缓存的曲目数据获取，保持原有的数组返回接口。 */
export async function getMusicData(forceRefresh = false): Promise<MusicData[]> {
  const result = await getMusicDataWithStatus(forceRefresh);
  return result.data;
}

/** 获取缓存时间戳 */
export async function getCacheTimestamp(): Promise<number | null> {
  try {
    return parseTimestamp(await AsyncStorage.getItem(CACHE_KEYS.musicDataVersion));
  } catch {
    return null;
  }
}

/** 清除曲目缓存 */
export async function clearMusicCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEYS.musicData, CACHE_KEYS.musicDataVersion]);
}