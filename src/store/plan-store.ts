/**
 * 推分计划 Zustand Store
 * 管理用户标记的推分歌曲列表（持久化到 AsyncStorage），
 * 并维护「推歌英灵殿」——从计划移除的曲目及其删除时间。
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanEntry, PlanGraveyardEntry, PushPlan } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import { compareByPinThenOrder } from '../data/plan-order';

export type PlanEntryKey = string;

export function planEntryKey(entry: Pick<PlanEntry, 'songId' | 'difficultyIndex' | 'musicType'>): PlanEntryKey {
  return `${entry.musicType || ''}:${entry.songId}:${entry.difficultyIndex}`;
}

interface PlanStore {
  /** 推分计划条目 */
  entries: PlanEntry[];
  /** 推歌英灵殿：被移除的条目与删除时间 */
  graveyard: PlanGraveyardEntry[];
  /** 是否已从存储加载 */
  loaded: boolean;

  /** 从 AsyncStorage 加载 */
  loadPlan: () => Promise<void>;
  /** 持久化到 AsyncStorage */
  savePlan: () => Promise<void>;
  saveGraveyard: () => Promise<void>;
  /** 添加/更新推分条目；新条目插入置顶组下方第一首的位置。 */
  addEntry: (entry: Omit<PlanEntry, 'addedAt' | 'order'>) => void;
  /** 批量添加；返回真正新增的 key 列表，供「一键加入/撤回」使用。 */
  bulkAddEntries: (entries: Array<Omit<PlanEntry, 'addedAt' | 'order'>>) => PlanEntryKey[];
  /** 移除推分条目（进入推歌英灵殿并记录时间） */
  removeEntry: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => void;
  /** 批量移除（默认进入英灵殿）；purge=true 时彻底删除且不进英灵殿。 */
  bulkRemoveEntries: (keys: PlanEntryKey[], options?: { purge?: boolean }) => void;
  /** 从英灵殿彻底删除一个条目 */
  purgeGraveyardEntry: (removedAt: number) => void;
  /** 清空英灵殿 */
  clearGraveyard: () => Promise<void>;
  /** 从英灵殿复原到计划（保留原备注/目标） */
  restoreGraveyardEntry: (removedAt: number) => void;
  /** 更新条目备注 */
  updateNote: (songId: string, difficultyIndex: number, note: string, musicType?: 'SD' | 'DX') => void;
  /** 更新目标分数；传 null 清除目标。 */
  updateTargetScore: (songId: string, difficultyIndex: number, score: number | null, musicType?: 'SD' | 'DX') => void;
  /** 设置/取消置顶置底标记 */
  setPin: (songId: string, difficultyIndex: number, pin: PlanEntry['pin'] | undefined, musicType?: 'SD' | 'DX') => void;
  /** 重新排序（已按置顶分组合法化的顺序） */
  reorder: (entries: PlanEntry[]) => void;
  /** 检查某歌曲是否在计划中 */
  isInPlan: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => boolean;
}

function matchesPlanEntry(entry: PlanEntry, songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX'): boolean {
  return entry.songId === songId
    && entry.difficultyIndex === difficultyIndex
    && (!musicType || !entry.musicType || entry.musicType === musicType);
}

/** 展示顺序：置顶 → 普通 → 置底，组内按 order；并把 order 归一化为数组下标。 */
function normalizeOrder(entries: PlanEntry[]): PlanEntry[] {
  return [...entries].sort(compareByPinThenOrder).map((entry, index) => ({ ...entry, order: index }));
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  entries: [],
  graveyard: [],
  loaded: false,

  loadPlan: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.planData);
      const rawGraveyard = await AsyncStorage.getItem(CACHE_KEYS.planGraveyard);
      const plan: PushPlan | null = raw ? JSON.parse(raw) : null;
      set({
        entries: plan?.entries || [],
        graveyard: rawGraveyard ? JSON.parse(rawGraveyard) : [],
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  savePlan: async () => {
    const { entries } = get();
    const plan: PushPlan = { entries, updatedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEYS.planData, JSON.stringify(plan));
  },

  saveGraveyard: async () => {
    const { graveyard } = get();
    await AsyncStorage.setItem(CACHE_KEYS.planGraveyard, JSON.stringify(graveyard));
  },

  addEntry: (entry) => {
    const { entries } = get();
    if (entries.some(e => matchesPlanEntry(e, entry.songId, entry.difficultyIndex, entry.musicType))) return;
    // 新条目插入「置顶组下方第一首」的位置：展示顺序中跳过置顶组后的第一个槽位。
    const sorted = normalizeOrder(entries);
    const insertAt = sorted.findIndex(e => e.pin !== 'top');
    const newEntry: PlanEntry = { ...entry, addedAt: Date.now(), order: 0 };
    if (insertAt < 0) {
      sorted.push(newEntry);
    } else {
      sorted.splice(insertAt, 0, newEntry);
    }
    set({ entries: normalizeOrder(sorted) });
    get().savePlan();
  },

  bulkAddEntries: (incoming) => {
    const { entries } = get();
    const addedKeys: PlanEntryKey[] = [];
    const working = normalizeOrder(entries);
    for (const entry of incoming) {
      if (working.some(e => matchesPlanEntry(e, entry.songId, entry.difficultyIndex, entry.musicType))) continue;
      addedKeys.push(planEntryKey(entry));
      const insertAt = working.findIndex(e => e.pin !== 'top');
      const newEntry: PlanEntry = { ...entry, addedAt: Date.now(), order: 0 };
      if (insertAt < 0) working.push(newEntry);
      else working.splice(insertAt, 0, newEntry);
    }
    if (addedKeys.length > 0) {
      set({ entries: normalizeOrder(working) });
      get().savePlan();
    }
    return addedKeys;
  },

  removeEntry: (songId, difficultyIndex, musicType) => {
    const { entries, graveyard } = get();
    const removed = entries.filter(e => matchesPlanEntry(e, songId, difficultyIndex, musicType));
    if (removed.length === 0) return;
    const remaining = entries.filter(e => !matchesPlanEntry(e, songId, difficultyIndex, musicType));
    const now = Date.now();
    set({
      entries: normalizeOrder(remaining),
      graveyard: [
        ...removed.map(entry => ({ entry, removedAt: now })),
        ...graveyard,
      ],
    });
    get().savePlan();
    get().saveGraveyard();
  },

  bulkRemoveEntries: (keys, options) => {
    const purge = options?.purge === true;
    const keySet = new Set(keys);
    const { entries, graveyard } = get();
    const removed = entries.filter(e => keySet.has(planEntryKey(e)));
    if (removed.length === 0) {
      // 即使没有可移除的条目，也允许 purge 清理英灵殿中的同 key 记录（撤回场景）。
      if (purge) {
        set({ graveyard: graveyard.filter(g => !keySet.has(planEntryKey(g.entry))) });
        get().saveGraveyard();
      }
      return;
    }
    const remaining = entries.filter(e => !keySet.has(planEntryKey(e)));
    const now = Date.now();
    set({
      entries: normalizeOrder(remaining),
      graveyard: purge
        ? graveyard.filter(g => !keySet.has(planEntryKey(g.entry)))
        : [...removed.map(entry => ({ entry, removedAt: now })), ...graveyard],
    });
    get().savePlan();
    get().saveGraveyard();
  },

  purgeGraveyardEntry: (removedAt) => {
    set({ graveyard: get().graveyard.filter(g => g.removedAt !== removedAt) });
    get().saveGraveyard();
  },

  clearGraveyard: async () => {
    set({ graveyard: [] });
    await AsyncStorage.removeItem(CACHE_KEYS.planGraveyard);
  },

  restoreGraveyardEntry: (removedAt) => {
    const target = get().graveyard.find(g => g.removedAt === removedAt);
    if (!target) return;
    set({ graveyard: get().graveyard.filter(g => g.removedAt !== removedAt) });
    get().saveGraveyard();
    get().addEntry(target.entry);
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

  setPin: (songId, difficultyIndex, pin, musicType) => {
    const { entries } = get();
    const newEntries = normalizeOrder(entries.map(e =>
      matchesPlanEntry(e, songId, difficultyIndex, musicType) ? { ...e, pin } : e
    ));
    set({ entries: newEntries });
    get().savePlan();
  },

  reorder: (entries) => {
    set({ entries: normalizeOrder(entries) });
    get().savePlan();
  },

  isInPlan: (songId, difficultyIndex, musicType) => {
    return get().entries.some(e => matchesPlanEntry(e, songId, difficultyIndex, musicType));
  },
}));
