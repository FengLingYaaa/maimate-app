/** Diving-Fish /chart_stats 客户端与缓存。 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChartStats, ChartStatsMap } from '../data/types';
import { CACHE_KEYS, PROBER_API_BASE } from '../constants/game';

const CHART_STATS_URL = `${PROBER_API_BASE}/chart_stats`;

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

export async function fetchChartStats(): Promise<ChartStatsMap> {
  const response = await fetch(CHART_STATS_URL);
  if (!response.ok) {
    throw new Error(`Chart stats request failed: ${response.status} ${response.statusText}`);
  }
  return normalizeChartStats(await response.json());
}

export async function getChartStats(forceRefresh = false): Promise<ChartStatsMap> {
  if (!forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.chartStats);
      if (cached) {
        const parsed = normalizeChartStats(JSON.parse(cached));
        if (Object.keys(parsed).length > 0) return parsed;
      }
    } catch {
      // 缓存损坏时继续请求网络。
    }
  }

  const data = await fetchChartStats();
  AsyncStorage.setItem(CACHE_KEYS.chartStats, JSON.stringify({ charts: data })).catch(() => {});
  return data;
}