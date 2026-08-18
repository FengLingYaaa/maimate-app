/**
 * Prober API 客户端
 * 数据来源: Diving-Fish 舞萌DX查分器 (MIT License)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MusicData } from '../data/types';
import { PROBER_API_BASE, CACHE_KEYS } from '../constants/game';

const MUSIC_DATA_URL = `${PROBER_API_BASE}/music_data`;

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

/** 带本地缓存的曲目数据获取 */
export async function getMusicData(forceRefresh = false): Promise<MusicData[]> {
  // 非强制刷新时，先尝试读取缓存
  if (!forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.musicData);
      if (cached) {
        const parsed: MusicData[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // 缓存不可用，继续网络请求
    }
  }

  // 从 API 获取
  const data = await fetchMusicData();

  // 写入缓存（异步不阻塞）
  AsyncStorage.setItem(CACHE_KEYS.musicData, JSON.stringify(data)).catch(() => {});
  AsyncStorage.setItem(CACHE_KEYS.musicDataVersion, Date.now().toString()).catch(() => {});

  return data;
}

/** 获取缓存时间戳 */
export async function getCacheTimestamp(): Promise<number | null> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.musicDataVersion);
    return ts ? parseInt(ts, 10) : null;
  } catch {
    return null;
  }
}

/** 清除曲目缓存 */
export async function clearMusicCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEYS.musicData, CACHE_KEYS.musicDataVersion]);
}