/**
 * 曲目数据 Zustand Store
 * 管理全量曲库加载、缓存状态、筛选结果
 */

import { create } from 'zustand';
import { MusicData, FilterOptions } from '../data/types';
import { MusicList } from '../data/music-list';
import { getMusicData, getCacheTimestamp } from '../api/prober';

interface MusicStore {
  /** 全量曲目原始数据 */
  rawData: MusicData[];
  /** 是否正在加载 */
  loading: boolean;
  /** 加载错误 */
  error: string | null;
  /** 缓存时间戳 */
  cacheTimestamp: number | null;
  /** 当前 MusicList 实例（应用筛选后） */
  musicList: MusicList;
  /** 当前筛选条件 */
  filters: FilterOptions;

  /** 从 API/缓存 加载曲目数据 */
  loadData: (forceRefresh?: boolean) => Promise<void>;
  /** 应用筛选 */
  applyFilters: (filters: FilterOptions) => void;
  /** 清除筛选 */
  clearFilters: () => void;
  /** 重置为全量 */
  getFullList: () => MusicList;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  rawData: [],
  loading: false,
  error: null,
  cacheTimestamp: null,
  musicList: new MusicList([]),
  filters: {},

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
    } catch (e: any) {
      const msg = e?.message || '未知错误';
      // 如果有缓存数据，静默使用缓存
      const { rawData } = get();
      if (rawData.length > 0) {
        set({ loading: false, error: `更新失败（使用缓存）: ${msg}` });
      } else {
        set({ loading: false, error: `数据加载失败: ${msg}` });
      }
    }
  },

  applyFilters: (filters: FilterOptions) => {
    const { rawData } = get();
    let list = new MusicList(rawData);

    // 检查是否有任何有效筛选
    const hasFilters = Object.values(filters).some(v => {
      if (v === undefined || v === null) return false;
      if (typeof v === 'string' && v.trim() === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });

    if (hasFilters) {
      list = list.filter(filters);
    }

    set({ musicList: list, filters });
  },

  clearFilters: () => {
    const { rawData } = get();
    set({ musicList: new MusicList(rawData), filters: {} });
  },

  getFullList: () => {
    return new MusicList(get().rawData);
  },
}));