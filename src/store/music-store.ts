/**
 * 曲目数据 Zustand Store
 * 管理全量曲库、筛选结果和 Diving-Fish 谱面统计。
 */

import { create } from 'zustand';
import { MusicData, FilterOptions, ChartStatsMap } from '../data/types';
import { MusicList } from '../data/music-list';
import { getCacheTimestamp, getMusicDataWithStatus } from '../api/prober';
import {
  getChartStatsCacheTimestamp,
  getChartStatsWithStatus,
} from '../api/chart-stats';

interface MusicStore {
  rawData: MusicData[];
  loading: boolean;
  /** 是否有任一缓存数据正在后台刷新。 */
  updating: boolean;
  musicDataUpdating: boolean;
  error: string | null;
  cacheTimestamp: number | null;
  musicList: MusicList;
  filters: FilterOptions;
  chartStats: ChartStatsMap;
  chartStatsLoading: boolean;
  chartStatsUpdating: boolean;
  chartStatsCacheTimestamp: number | null;
  chartStatsError: string | null;

  loadData: (forceRefresh?: boolean) => Promise<void>;
  loadChartStats: (forceRefresh?: boolean) => Promise<void>;
  applyFilters: (filters: FilterOptions) => void;
  clearFilters: () => void;
  getFullList: () => MusicList;
}

let musicLoadSequence = 0;
let chartStatsLoadSequence = 0;

function hasFilters(filters: FilterOptions): boolean {
  return Object.values(filters).some(value => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

function createMusicList(data: MusicData[], filters: FilterOptions, chartStats?: ChartStatsMap): MusicList {
  return hasFilters(filters)
    ? new MusicList(data).filter(filters, chartStats)
    : new MusicList(data);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  rawData: [],
  loading: false,
  updating: false,
  musicDataUpdating: false,
  error: null,
  cacheTimestamp: null,
  musicList: new MusicList([]),
  filters: {},
  chartStats: {},
  chartStatsLoading: false,
  chartStatsUpdating: false,
  chartStatsCacheTimestamp: null,
  chartStatsError: null,

  loadData: async (forceRefresh = false) => {
    const requestId = ++musicLoadSequence;
    set({
      loading: true,
      error: null,
      musicDataUpdating: false,
      updating: get().chartStatsUpdating,
    });

    try {
      const result = await getMusicDataWithStatus(forceRefresh);
      if (requestId !== musicLoadSequence) return;

      // 强制刷新继续保留原有行为；自动缓存读取和后台更新使用当前筛选条件。
      const nextFilters = forceRefresh ? {} : get().filters;
      const hasBackgroundRefresh = result.backgroundRefresh !== null;
      set({
        rawData: result.data,
        musicList: createMusicList(result.data, nextFilters),
        filters: nextFilters,
        loading: false,
        cacheTimestamp: result.cacheTimestamp,
        musicDataUpdating: hasBackgroundRefresh,
        updating: hasBackgroundRefresh || get().chartStatsUpdating,
      });

      // 统计数据不阻塞曲库首屏；详情页会在加载完成后自动显示拟合定数。
      void get().loadChartStats(forceRefresh);

      if (result.backgroundRefresh) {
        void result.backgroundRefresh
          .then(async data => {
            if (requestId !== musicLoadSequence) return;
            const timestamp = await getCacheTimestamp();
            if (requestId !== musicLoadSequence) return;

            const currentFilters = get().filters;
            set({
              rawData: data,
              musicList: createMusicList(data, currentFilters),
              loading: false,
              cacheTimestamp: timestamp ?? Date.now(),
              musicDataUpdating: false,
              updating: get().chartStatsUpdating,
              error: null,
            });
          })
          .catch(error => {
            if (requestId !== musicLoadSequence) return;
            const message = getErrorMessage(error, '未知错误');
            set({
              loading: false,
              musicDataUpdating: false,
              updating: get().chartStatsUpdating,
              error: `更新失败（使用缓存）: ${message}`,
            });
          });
      }
    } catch (error) {
      if (requestId !== musicLoadSequence) return;
      const message = getErrorMessage(error, '未知错误');
      const { rawData } = get();
      set({
        loading: false,
        musicDataUpdating: false,
        updating: get().chartStatsUpdating,
        error: rawData.length > 0
          ? `更新失败（使用缓存）: ${message}`
          : `数据加载失败: ${message}`,
      });
    }
  },

  loadChartStats: async (forceRefresh = false) => {
    const requestId = ++chartStatsLoadSequence;
    set({
      chartStatsLoading: true,
      chartStatsUpdating: false,
      chartStatsError: null,
      updating: get().musicDataUpdating,
    });

    try {
      const result = await getChartStatsWithStatus(forceRefresh);
      if (requestId !== chartStatsLoadSequence) return;

      const hasBackgroundRefresh = result.backgroundRefresh !== null;
      set({
        chartStats: result.data,
        chartStatsLoading: false,
        chartStatsUpdating: hasBackgroundRefresh,
        chartStatsCacheTimestamp: result.cacheTimestamp,
        updating: get().musicDataUpdating || hasBackgroundRefresh,
      });

      if (result.backgroundRefresh) {
        void result.backgroundRefresh
          .then(async chartStats => {
            if (requestId !== chartStatsLoadSequence) return;
            const timestamp = await getChartStatsCacheTimestamp();
            if (requestId !== chartStatsLoadSequence) return;

            set({
              chartStats,
              chartStatsLoading: false,
              chartStatsUpdating: false,
              chartStatsCacheTimestamp: timestamp ?? Date.now(),
              updating: get().musicDataUpdating,
              chartStatsError: null,
            });
          })
          .catch(error => {
            if (requestId !== chartStatsLoadSequence) return;
            set({
              chartStatsLoading: false,
              chartStatsUpdating: false,
              updating: get().musicDataUpdating,
              chartStatsError: getErrorMessage(error, '拟合定数暂时不可用'),
            });
          });
      }
    } catch (error) {
      if (requestId !== chartStatsLoadSequence) return;
      set({
        chartStatsLoading: false,
        chartStatsUpdating: false,
        updating: get().musicDataUpdating,
        chartStatsError: getErrorMessage(error, '拟合定数暂时不可用'),
      });
    }
  },

  applyFilters: (filters: FilterOptions) => {
    const { rawData, chartStats } = get();
    // v1.16.0：带 chartStats 供拟合定数排序使用。
    set({ musicList: createMusicList(rawData, filters, chartStats), filters });
  },

  clearFilters: () => {
    const { rawData } = get();
    set({ musicList: new MusicList(rawData), filters: {} });
  },

  getFullList: () => new MusicList(get().rawData),
}));