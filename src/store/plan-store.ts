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
  removeEntry: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => void;
  /** 更新条目备注 */
  updateNote: (songId: string, difficultyIndex: number, note: string, musicType?: 'SD' | 'DX') => void;
  /** 更新目标分数；传 null 清除目标。 */
  updateTargetScore: (songId: string, difficultyIndex: number, score: number | null, musicType?: 'SD' | 'DX') => void;
  /** 重新排序 */
  reorder: (entries: PlanEntry[]) => void;
  /** 将单个条目移动到计划顶部/底部。 */
  moveToTop: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => void;
  moveToBottom: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => void;
  /** 检查某歌曲是否在计划中 */
  isInPlan: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => boolean;
  /** 清空计划 */
  clearPlan: () => Promise<void>;
}

function matchesPlanEntry(entry: PlanEntry, songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX'): boolean {
  return entry.songId === songId
    && entry.difficultyIndex === difficultyIndex
    && (!musicType || !entry.musicType || entry.musicType === musicType);
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
    const exists = entries.find(e => matchesPlanEntry(e, entry.songId, entry.difficultyIndex, entry.musicType));
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

  removeEntry: (songId, difficultyIndex, musicType) => {
    const { entries } = get();
    const newEntries = entries.filter(e => !matchesPlanEntry(e, songId, difficultyIndex, musicType));
    set({ entries: newEntries });
    get().savePlan();
  },

  updateNote: (songId, difficultyIndex, note, musicType) => {
    const { entries } = get();
    const newEntries = entries.map(e =>
      matchesPlanEntry(e, songId, difficultyIndex, musicType)
        ? { ...e, note }
        : e
    );
    set({ entries: newEntries });
    get().savePlan();
  },

  updateTargetScore: (songId, difficultyIndex, score, musicType) => {
    const { entries } = get();
    const newEntries = entries.map(e => {
      if (!matchesPlanEntry(e, songId, difficultyIndex, musicType)) return e;
      if (score === null) {
        const { targetScore: _targetScore, ...withoutTarget } = e;
        return withoutTarget;
      }
      return { ...e, targetScore: score };
    });
    set({ entries: newEntries });
    get().savePlan();
  },

  reorder: (entries) => {
    const reordered = entries.map((e, i) => ({ ...e, order: i }));
    set({ entries: reordered });
    get().savePlan();
  },

  moveToTop: (songId, difficultyIndex, musicType) => {
    const { entries } = get();
    const index = entries.findIndex(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType));
    if (index <= 0) return;
    const next = [...entries];
    const [entry] = next.splice(index, 1);
    next.unshift(entry);
    get().reorder(next);
  },

  moveToBottom: (songId, difficultyIndex, musicType) => {
    const { entries } = get();
    const index = entries.findIndex(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType));
    if (index < 0 || index === entries.length - 1) return;
    const next = [...entries];
    const [entry] = next.splice(index, 1);
    next.push(entry);
    get().reorder(next);
  },

  isInPlan: (songId, difficultyIndex, musicType) => {
    return get().entries.some(e => matchesPlanEntry(e, songId, difficultyIndex, musicType));
  },

  clearPlan: async () => {
    set({ entries: [] });
    await AsyncStorage.removeItem(CACHE_KEYS.planData);
  },
}));