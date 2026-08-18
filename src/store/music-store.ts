/**
 * 曲目数据 Zustand Store
 * 管理全量曲库、筛选结果和 Diving-Fish 谱面统计。
 */

import { create } from 'zustand';
import { MusicData, FilterOptions, ChartStatsMap } from '../data/types';
import { MusicList } from '../data/music-list';
import { getMusicData, getCacheTimestamp } from '../api/prober';
import { getChartStats } from '../api/chart-stats';

interface MusicStore {
  rawData: MusicData[];
  loading: boolean;
  error: string | null;
  cacheTimestamp: number | null;
  musicList: MusicList;
  filters: FilterOptions;
  chartStats: ChartStatsMap;
  chartStatsLoading: boolean;
  chartStatsError: string | null;

  loadData: (forceRefresh?: boolean) => Promise<void>;
  loadChartStats: (forceRefresh?: boolean) => Promise<void>;
  applyFilters: (filters: FilterOptions) => void;
  clearFilters: () => void;
  getFullList: () => MusicList;
}

function hasFilters(filters: FilterOptions): boolean {
  return Object.values(filters).some(value => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  rawData: [],
  loading: false,
  error: null,
  cacheTimestamp: null,
  musicList: new MusicList([]),
  filters: {},
  chartStats: {},
  chartStatsLoading: false,
  chartStatsError: null,

  loadData: async (forceRefresh = false) => {
    set({ loading: true, error: null });
    try {
      const data = await getMusicData(forceRefresh);
      const list = new MusicList(data);
      const ts = await getCacheTimestamp();
      set({
        rawData: data,
        musicList: list,
        loading: false,
        cacheTimestamp: ts,
        filters: {},
      });
      // 统计数据不阻塞曲库首屏；详情页会在加载完成后自动显示拟合定数。
      void get().loadChartStats(forceRefresh);
    } catch (e: any) {
      const msg = e?.message || '未知错误';
      const { rawData } = get();
      if (rawData.length > 0) {
        set({ loading: false, error: `更新失败（使用缓存）: ${msg}` });
      } else {
        set({ loading: false, error: `数据加载失败: ${msg}` });
      }
    }
  },

  loadChartStats: async (forceRefresh = false) => {
    set({ chartStatsLoading: true, chartStatsError: null });
    try {
      const chartStats = await getChartStats(forceRefresh);
      set({ chartStats, chartStatsLoading: false });
    } catch (e: any) {
      set({
        chartStatsLoading: false,
        chartStatsError: e?.message || '拟合定数暂时不可用',
      });
    }
  },

  applyFilters: (filters: FilterOptions) => {
    const { rawData } = get();
    const list = hasFilters(filters)
      ? new MusicList(rawData).filter(filters)
      : new MusicList(rawData);
    set({ musicList: list, filters });
  },

  clearFilters: () => {
    const { rawData } = get();
    set({ musicList: new MusicList(rawData), filters: {} });
  },

  getFullList: () => new MusicList(get().rawData),
}));