/**
 * 推分计划 Zustand Store
 * 管理用户标记的推分歌曲列表（持久化到 AsyncStorage）
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanEntry, PushPlan } from '../data/types';
import { CACHE_KEYS } from '../constants/game';

interface PlanStore {
  /** 推分计划条目 */
  entries: PlanEntry[];
  /** 是否已从存储加载 */
  loaded: boolean;

  /** 从 AsyncStorage 加载 */
  loadPlan: () => Promise<void>;
  /** 持久化到 AsyncStorage */
  savePlan: () => Promise<void>;
  /** 添加/更新推分条目 */
  addEntry: (entry: Omit<PlanEntry, 'addedAt' | 'order'>) => void;
  /** 移除推分条目 */
  removeEntry: (songId: string, difficultyIndex: number) => void;
  /** 更新条目备注 */
  updateNote: (songId: string, difficultyIndex: number, note: string) => void;
  /** 更新目标分数 */
  updateTargetScore: (songId: string, difficultyIndex: number, score: number) => void;
  /** 重新排序 */
  reorder: (entries: PlanEntry[]) => void;
  /** 检查某歌曲是否在计划中 */
  isInPlan: (songId: string, difficultyIndex: number) => boolean;
  /** 清空计划 */
  clearPlan: () => Promise<void>;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  entries: [],
  loaded: false,

  loadPlan: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.planData);
      if (raw) {
        const plan: PushPlan = JSON.parse(raw);
        set({ entries: plan.entries || [], loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  savePlan: async () => {
    const { entries } = get();
    const plan: PushPlan = { entries, updatedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEYS.planData, JSON.stringify(plan));
  },

  addEntry: (entry) => {
    const { entries } = get();
    const exists = entries.find(
      e => e.songId === entry.songId && e.difficultyIndex === entry.difficultyIndex
    );
    if (exists) return;

    const newEntry: PlanEntry = {
      ...entry,
      addedAt: Date.now(),
      order: entries.length,
    };
    const newEntries = [...entries, newEntry];
    set({ entries: newEntries });
    get().savePlan();
  },

  removeEntry: (songId, difficultyIndex) => {
    const { entries } = get();
    const newEntries = entries.filter(
      e => !(e.songId === songId && e.difficultyIndex === difficultyIndex)
    );
    set({ entries: newEntries });
    get().savePlan();
  },

  updateNote: (songId, difficultyIndex, note) => {
    const { entries } = get();
    const newEntries = entries.map(e =>
      e.songId === songId && e.difficultyIndex === difficultyIndex
        ? { ...e, note }
        : e
    );
    set({ entries: newEntries });
    get().savePlan();
  },

  updateTargetScore: (songId, difficultyIndex, score) => {
    const { entries } = get();
    const newEntries = entries.map(e =>
      e.songId === songId && e.difficultyIndex === difficultyIndex
        ? { ...e, targetScore: score }
        : e
    );
    set({ entries: newEntries });
    get().savePlan();
  },

  reorder: (entries) => {
    const reordered = entries.map((e, i) => ({ ...e, order: i }));
    set({ entries: reordered });
    get().savePlan();
  },

  isInPlan: (songId, difficultyIndex) => {
    return get().entries.some(
      e => e.songId === songId && e.difficultyIndex === difficultyIndex
    );
  },

  clearPlan: async () => {
    set({ entries: [] });
    await AsyncStorage.removeItem(CACHE_KEYS.planData);
  },
}));