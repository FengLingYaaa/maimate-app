/** Diving-Fish /chart_stats 客户端与缓存。 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChartStats, ChartStatsMap } from '../data/types';
import { CACHE_KEYS, CACHE_MAX_AGE_MS, PROBER_API_BASE } from '../constants/game';

const CHART_STATS_URL = `${PROBER_API_BASE}/chart_stats`;

export interface ChartStatsCacheResult {
  data: ChartStatsMap;
  cacheTimestamp: number | null;
  fromCache: boolean;
  stale: boolean;
  backgroundRefresh: Promise<ChartStatsMap> | null;
}

function isChartStats(value: unknown): value is ChartStats {
  if (!value || typeof value !== 'object') return false;
  const stats = value as Partial<ChartStats>;
  return typeof stats.fit_diff === 'number' && typeof stats.cnt === 'number';
}

function normalizeChartStats(value: unknown): ChartStatsMap {
  if (!value || typeof value !== 'object') return {};
  const charts = (value as { charts?: unknown }).charts;
  if (!charts || typeof charts !== 'object') return {};

  const result: ChartStatsMap = {};
  for (const [songId, entries] of Object.entries(charts as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    result[songId] = entries.map(entry => isChartStats(entry) ? entry : null);
  }
  return result;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function isStale(timestamp: number | null): boolean {
  return timestamp === null || Date.now() - timestamp >= CACHE_MAX_AGE_MS;
}

export async function fetchChartStats(): Promise<ChartStatsMap> {
  const response = await fetch(CHART_STATS_URL);
  if (!response.ok) {
    throw new Error(`Chart stats request failed: ${response.status} ${response.statusText}`);
  }
  return normalizeChartStats(await response.json());
}

async function readCachedChartStats(): Promise<{
  data: ChartStatsMap;
  cacheTimestamp: number | null;
} | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.chartStats);
    if (!cached) return null;

    const parsed = normalizeChartStats(JSON.parse(cached));
    if (Object.keys(parsed).length === 0) return null;

    let timestampValue: string | null = null;
    try {
      timestampValue = await AsyncStorage.getItem(CACHE_KEYS.chartStatsVersion);
    } catch {
      // 缺少时间戳时按过期缓存处理，但缓存内容仍然可用。
    }

    return {
      data: parsed,
      cacheTimestamp: parseTimestamp(timestampValue),
    };
  } catch {
    // 缓存损坏或存储不可用时，继续网络请求。
    return null;
  }
}

async function writeChartStatsCache(data: ChartStatsMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.chartStats, JSON.stringify({ charts: data }));
    await AsyncStorage.setItem(CACHE_KEYS.chartStatsVersion, Date.now().toString());
  } catch {
    // 网络数据仍然可用，缓存写入失败不应使本次请求失败。
  }
}

/** 拉取网络数据并更新本地缓存。 */
export async function refreshChartStats(): Promise<ChartStatsMap> {
  const data = await fetchChartStats();
  await writeChartStatsCache(data);
  return data;
}

/**
 * 获取谱面统计及缓存状态。
 * 过期缓存会先返回，并同时启动一个可观察的后台刷新 Promise。
 */
export async function getChartStatsWithStatus(forceRefresh = false): Promise<ChartStatsCacheResult> {
  if (forceRefresh) {
    const data = await refreshChartStats();
    return {
      data,
      cacheTimestamp: await getChartStatsCacheTimestamp(),
      fromCache: false,
      stale: false,
      backgroundRefresh: null,
    };
  }

  const cached = await readCachedChartStats();
  if (!cached) {
    const data = await refreshChartStats();
    return {
      data,
      cacheTimestamp: await getChartStatsCacheTimestamp(),
      fromCache: false,
      stale: false,
      backgroundRefresh: null,
    };
  }

  const stale = isStale(cached.cacheTimestamp);
  const backgroundRefresh = stale ? refreshChartStats() : null;
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

/** 带本地缓存的谱面统计获取，保持原有的 map 返回接口。 */
export async function getChartStats(forceRefresh = false): Promise<ChartStatsMap> {
  const result = await getChartStatsWithStatus(forceRefresh);
  return result.data;
}

/** 获取谱面统计缓存时间戳。 */
export async function getChartStatsCacheTimestamp(): Promise<number | null> {
  try {
    return parseTimestamp(await AsyncStorage.getItem(CACHE_KEYS.chartStatsVersion));
  } catch {
    return null;
  }
}

/** 清除谱面统计缓存。 */
export async function clearChartStatsCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEYS.chartStats, CACHE_KEYS.chartStatsVersion]);
}