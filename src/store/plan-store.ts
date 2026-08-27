/** 推分计划 Store：稳定 entryId、原子拖拽重排、串行持久化与英灵殿。 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanEntry, PlanGraveyardEntry, PushPlan } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import {
  createPlanEntryId,
  migratePlanEntryIds,
  migratePlanGraveyardIds,
  normalizePlanEntries,
  reorderPlanEntriesById,
} from '../data/plan-entries';

export type PlanEntryKey = string;
type PlanEntryInput = Omit<PlanEntry, 'entryId' | 'addedAt' | 'order'>;

/** 业务谱面键仅用于“一键加入/撤回”；拖拽和 React key 不再使用它。 */
export function planEntryKey(entry: Pick<PlanEntry, 'songId' | 'difficultyIndex' | 'musicType'>): PlanEntryKey {
  return `${entry.musicType || ''}:${entry.songId}:${entry.difficultyIndex}`;
}

interface PlanStore {
  entries: PlanEntry[];
  graveyard: PlanGraveyardEntry[];
  loaded: boolean;
  loadPlan: () => Promise<void>;
  savePlan: () => Promise<void>;
  saveGraveyard: () => Promise<void>;
  addEntry: (entry: PlanEntryInput) => void;
  bulkAddEntries: (entries: PlanEntryInput[]) => PlanEntryKey[];
  removeEntry: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => void;
  removeEntryById: (entryId: string) => void;
  bulkRemoveEntries: (keys: PlanEntryKey[], options?: { purge?: boolean }) => void;
  purgeGraveyardEntry: (removedAt: number) => void;
  clearGraveyard: () => Promise<void>;
  restoreGraveyardEntry: (removedAt: number) => void;
  updateNote: (songId: string, difficultyIndex: number, note: string, musicType?: 'SD' | 'DX') => void;
  updateTargetScore: (songId: string, difficultyIndex: number, score: number | null, musicType?: 'SD' | 'DX') => void;
  updateTargetScoreById: (entryId: string, score: number | null) => void;
  /** v1.12.0：批量清除指定条目的目标分数（保留条目）。 */
  clearAchievedTargets: (achievedEntryIds: string[]) => void;
  setPin: (songId: string, difficultyIndex: number, pin: PlanEntry['pin'] | undefined, musicType?: 'SD' | 'DX') => void;
  setPinById: (entryId: string, pin: PlanEntry['pin'] | undefined) => void;
  reorderByIds: (orderedIds: string[]) => boolean;
  isInPlan: (songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX') => boolean;
}

function matchesPlanEntry(entry: PlanEntry, songId: string, difficultyIndex: number, musicType?: 'SD' | 'DX'): boolean {
  return entry.songId === songId
    && entry.difficultyIndex === difficultyIndex
    && (!musicType || !entry.musicType || entry.musicType === musicType);
}

let planPersistQueue: Promise<void> = Promise.resolve();
let graveyardPersistQueue: Promise<void> = Promise.resolve();

function enqueuePlanPersist(entries: PlanEntry[]): Promise<void> {
  const payload: PushPlan = { entries, updatedAt: Date.now() };
  const serialized = JSON.stringify(payload);
  planPersistQueue = planPersistQueue.catch(() => undefined).then(() => AsyncStorage.setItem(CACHE_KEYS.planData, serialized));
  return planPersistQueue;
}

function enqueueGraveyardPersist(graveyard: PlanGraveyardEntry[]): Promise<void> {
  const serialized = JSON.stringify(graveyard);
  graveyardPersistQueue = graveyardPersistQueue.catch(() => undefined).then(() => AsyncStorage.setItem(CACHE_KEYS.planGraveyard, serialized));
  return graveyardPersistQueue;
}

export async function flushPlanPersistence(): Promise<void> {
  await Promise.all([planPersistQueue.catch(() => undefined), graveyardPersistQueue.catch(() => undefined)]);
}

function withTargetScore(entry: PlanEntry, score: number | null): PlanEntry {
  if (score === null) {
    const { targetScore: _targetScore, ...withoutTarget } = entry;
    return withoutTarget;
  }
  return { ...entry, targetScore: score };
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  entries: [],
  graveyard: [],
  loaded: false,

  loadPlan: async () => {
    try {
      const [raw, rawGraveyard] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.planData),
        AsyncStorage.getItem(CACHE_KEYS.planGraveyard),
      ]);
      const parsedPlan = raw ? JSON.parse(raw) as Partial<PushPlan> : null;
      const parsedEntries = Array.isArray(parsedPlan?.entries) ? parsedPlan.entries as PlanEntry[] : [];
      const parsedGraveyard = rawGraveyard ? JSON.parse(rawGraveyard) : [];
      const migratedEntries = migratePlanEntryIds(parsedEntries);
      const migratedGraveyard = migratePlanGraveyardIds(Array.isArray(parsedGraveyard) ? parsedGraveyard : []);
      const entries = normalizePlanEntries(migratedEntries.entries);
      const graveyard = migratedGraveyard.graveyard;
      set({ entries, graveyard, loaded: true });
      if (migratedEntries.migrated) await enqueuePlanPersist(entries);
      if (migratedGraveyard.migrated) await enqueueGraveyardPersist(graveyard);
    } catch {
      set({ entries: [], graveyard: [], loaded: true });
    }
  },

  savePlan: async () => enqueuePlanPersist(get().entries),
  saveGraveyard: async () => enqueueGraveyardPersist(get().graveyard),

  addEntry: entry => {
    const current = get().entries;
    if (current.some(item => matchesPlanEntry(item, entry.songId, entry.difficultyIndex, entry.musicType))) return;
    const sorted = normalizePlanEntries(current);
    const insertAt = sorted.findIndex(item => item.pin !== 'top');
    const newEntry: PlanEntry = { ...entry, entryId: createPlanEntryId(), addedAt: Date.now(), order: 0 };
    if (insertAt < 0) sorted.push(newEntry);
    else sorted.splice(insertAt, 0, newEntry);
    const entries = normalizePlanEntries(sorted);
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  bulkAddEntries: incoming => {
    const addedKeys: PlanEntryKey[] = [];
    const working = normalizePlanEntries(get().entries);
    for (const entry of incoming) {
      if (working.some(item => matchesPlanEntry(item, entry.songId, entry.difficultyIndex, entry.musicType))) continue;
      addedKeys.push(planEntryKey(entry));
      const insertAt = working.findIndex(item => item.pin !== 'top');
      const newEntry: PlanEntry = { ...entry, entryId: createPlanEntryId(), addedAt: Date.now(), order: 0 };
      if (insertAt < 0) working.push(newEntry);
      else working.splice(insertAt, 0, newEntry);
    }
    if (addedKeys.length > 0) {
      const entries = normalizePlanEntries(working);
      set({ entries });
      void enqueuePlanPersist(entries);
    }
    return addedKeys;
  },

  removeEntry: (songId, difficultyIndex, musicType) => {
    const removed = get().entries.filter(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType));
    if (removed.length === 0) return;
    const entries = normalizePlanEntries(get().entries.filter(entry => !matchesPlanEntry(entry, songId, difficultyIndex, musicType)));
    const now = Date.now();
    const graveyard = [...removed.map((entry, index) => ({ entry, removedAt: now + index })), ...get().graveyard];
    set({ entries, graveyard });
    void enqueuePlanPersist(entries);
    void enqueueGraveyardPersist(graveyard);
  },

  removeEntryById: entryId => {
    const target = get().entries.find(entry => entry.entryId === entryId);
    if (!target) return;
    const entries = normalizePlanEntries(get().entries.filter(entry => entry.entryId !== entryId));
    const graveyard = [{ entry: target, removedAt: Date.now() }, ...get().graveyard];
    set({ entries, graveyard });
    void enqueuePlanPersist(entries);
    void enqueueGraveyardPersist(graveyard);
  },

  bulkRemoveEntries: (keys, options) => {
    const purge = options?.purge === true;
    const keySet = new Set(keys);
    const removed = get().entries.filter(entry => keySet.has(planEntryKey(entry)));
    if (removed.length === 0) {
      if (purge) {
        const graveyard = get().graveyard.filter(item => !keySet.has(planEntryKey(item.entry)));
        set({ graveyard });
        void enqueueGraveyardPersist(graveyard);
      }
      return;
    }
    const entries = normalizePlanEntries(get().entries.filter(entry => !keySet.has(planEntryKey(entry))));
    const now = Date.now();
    const graveyard = purge
      ? get().graveyard.filter(item => !keySet.has(planEntryKey(item.entry)))
      : [...removed.map((entry, index) => ({ entry, removedAt: now + index })), ...get().graveyard];
    set({ entries, graveyard });
    void enqueuePlanPersist(entries);
    void enqueueGraveyardPersist(graveyard);
  },

  purgeGraveyardEntry: removedAt => {
    const graveyard = get().graveyard.filter(item => item.removedAt !== removedAt);
    set({ graveyard });
    void enqueueGraveyardPersist(graveyard);
  },

  clearGraveyard: async () => {
    set({ graveyard: [] });
    await flushPlanPersistence();
    await AsyncStorage.removeItem(CACHE_KEYS.planGraveyard);
  },

  restoreGraveyardEntry: removedAt => {
    const target = get().graveyard.find(item => item.removedAt === removedAt);
    if (!target) return;
    const graveyard = get().graveyard.filter(item => item.removedAt !== removedAt);
    set({ graveyard });
    void enqueueGraveyardPersist(graveyard);
    get().addEntry({
      songId: target.entry.songId,
      difficultyIndex: target.entry.difficultyIndex,
      musicType: target.entry.musicType,
      note: target.entry.note,
      targetScore: target.entry.targetScore,
      pin: target.entry.pin,
    });
  },

  updateNote: (songId, difficultyIndex, note, musicType) => {
    const entries = get().entries.map(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType) ? { ...entry, note } : entry);
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  updateTargetScore: (songId, difficultyIndex, score, musicType) => {
    const entries = get().entries.map(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType) ? withTargetScore(entry, score) : entry);
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  updateTargetScoreById: (entryId, score) => {
    const entries = get().entries.map(entry => entry.entryId === entryId ? withTargetScore(entry, score) : entry);
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  /** v1.12.0：批量清除已达标条目的目标分数（保留条目本身）。 */
  clearAchievedTargets: achievedEntryIds => {
    const achieved = new Set(achievedEntryIds);
    const entries = get().entries.map(entry => achieved.has(entry.entryId) ? withTargetScore(entry, null) : entry);
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  setPin: (songId, difficultyIndex, pin, musicType) => {
    const entries = normalizePlanEntries(get().entries.map(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType) ? { ...entry, pin } : entry));
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  setPinById: (entryId, pin) => {
    const entries = normalizePlanEntries(get().entries.map(entry => entry.entryId === entryId ? { ...entry, pin } : entry));
    set({ entries });
    void enqueuePlanPersist(entries);
  },

  reorderByIds: orderedIds => {
    const entries = reorderPlanEntriesById(get().entries, orderedIds);
    if (!entries) return false;
    set({ entries });
    void enqueuePlanPersist(entries);
    return true;
  },

  isInPlan: (songId, difficultyIndex, musicType) => get().entries.some(entry => matchesPlanEntry(entry, songId, difficultyIndex, musicType)),
}));
