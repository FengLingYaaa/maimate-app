/**
 * 曲目数据 Zustand Store
 * 管理全量曲库、筛选结果和 Diving-Fish 谱面统计。
 */

import { create } from 'zustand';
import { MusicData, FilterOptions, ChartStatsMap } from '../data/types';
import { MusicList, matchesMusic, sortMusicItems } from '../data/music-list';
import type { ScoreIndex } from '../data/music-list';
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
  /** v1.17.1：内存态——当前筛选生效的本机成绩索引；后台/统计重建 musicList 时复用，避免冷启动或刷新后成绩排序丢失。 */
  activeScoreIndex?: ScoreIndex;
  chartStats: ChartStatsMap;
  chartStatsLoading: boolean;
  chartStatsUpdating: boolean;
  chartStatsCacheTimestamp: number | null;
  chartStatsError: string | null;

  loadData: (forceRefresh?: boolean) => Promise<void>;
  loadChartStats: (forceRefresh?: boolean) => Promise<void>;
  applyFilters: (filters: FilterOptions, scoreIndex?: ScoreIndex) => void;
  /** v1.16.8：分片应用筛选（评分+过滤一趟完成），进度回调给 UI 进度条。 */
  applyFiltersChunked: (filters: FilterOptions, onProgress?: (done: number, total: number) => void, scoreIndex?: ScoreIndex) => Promise<number>;
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

function createMusicList(data: MusicData[], filters: FilterOptions, chartStats?: ChartStatsMap, scoreIndex?: ScoreIndex): MusicList {
  return hasFilters(filters)
    ? new MusicList(data).filter(filters, chartStats, scoreIndex)
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
  activeScoreIndex: undefined,
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
      // v1.17.1：重建 musicList 时带上当前 chartStats 与记忆的成绩索引，保证冷启动/后台更新后拟合排序与成绩排序不走样；
      // 强制刷新清空筛选时顺带清空索引（下次 applyFilters 会重新写入）。
      const nextActiveScoreIndex = forceRefresh ? undefined : get().activeScoreIndex;
      const hasBackgroundRefresh = result.backgroundRefresh !== null;
      set({
        rawData: result.data,
        musicList: createMusicList(result.data, nextFilters, get().chartStats, nextActiveScoreIndex),
        filters: nextFilters,
        activeScoreIndex: nextActiveScoreIndex,
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
            // v1.17.1：后台刷新重建 musicList 时同样带上最新 chartStats 与成绩索引。
            set({
              rawData: data,
              musicList: createMusicList(data, currentFilters, get().chartStats, get().activeScoreIndex),
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
      // v1.17.1：统计首次可用后，若当前已有筛选中的列表（rawData/filters 存在），
      // 用最新 chartStats + 记忆的成绩索引重建 musicList，拟合定数排序立即生效。
      const current = get();
      const nextMusicList = current.rawData.length > 0 && hasFilters(current.filters)
        ? createMusicList(current.rawData, current.filters, result.data, current.activeScoreIndex)
        : current.musicList;
      set({
        chartStats: result.data,
        musicList: nextMusicList,
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

            // v1.17.1：后台统计更新同样按当前筛选重建列表，保证拟合/成绩排序拿到最新拟合定数。
            const current = get();
            const nextMusicList = current.rawData.length > 0 && hasFilters(current.filters)
              ? createMusicList(current.rawData, current.filters, chartStats, current.activeScoreIndex)
              : current.musicList;
            set({
              chartStats,
              musicList: nextMusicList,
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

  applyFilters: (filters: FilterOptions, scoreIndex?: ScoreIndex) => {
    const { rawData, chartStats } = get();
    // v1.16.0：带 chartStats 供拟合定数排序使用。
    // v1.17.1：记住本轮筛选使用的成绩索引，后续重建 musicList（冷启动/后台刷新/统计加载完成）时复用。
    set({ musicList: createMusicList(rawData, filters, chartStats, scoreIndex), filters, activeScoreIndex: scoreIndex });
  },

  applyFiltersChunked: async (filters, onProgress, scoreIndex) => {
    const { rawData, chartStats } = get();
    const total = rawData.length;
    // v1.16.8：评分+过滤一趟完成（v1.16.7 是评分一遍、applyFilters 再过滤一遍的双遍），
    // 每片让出线程给 UI，进度真实反映剩余工作量；排序只对命中子集做。
    const matched: MusicData[] = [];
    const CHUNK = 80;
    for (let start = 0; start < total; start += CHUNK) {
      const end = Math.min(start + CHUNK, total);
      for (let index = start; index < end; index += 1) {
        if (matchesMusic(rawData[index], filters)) matched.push(rawData[index]);
      }
      onProgress?.(end, total);
      // v1.16.9：setImmediate 在 RN 里不保证让出渲染帧（同一任务队列内连续执行），
      // 进度条要等全部算完才出现。setTimeout(0) 是宏任务，能让 UI 真实刷新。
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    const sorted = sortMusicItems(matched, filters.sort, filters.titleSearch, chartStats, scoreIndex);
    // v1.17.1：分片路径同样记住本轮成绩索引。
    set({ musicList: new MusicList(sorted), filters, activeScoreIndex: scoreIndex });
    return matched.length;
  },

  clearFilters: () => {
    const { rawData } = get();
    set({ musicList: new MusicList(rawData), filters: {} });
  },

  getFullList: () => new MusicList(get().rawData),
}));