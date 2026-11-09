/**
 * Rating 历史 store（v1.18.0）：AsyncStorage `maimate.rating-history.v1`，一次追加一条。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  RATING_HISTORY_STORAGE_KEY,
  appendRatingPoint,
  parseRatingHistory,
  type RatingHistoryPoint,
} from '../data/rating-history';

interface RatingHistoryState {
  points: RatingHistoryPoint[];
  updatedAt?: string;
  loaded: boolean;
  load: () => Promise<void>;
  /** 记录一个点；返回是否真正写入（当天已记且总 Rating 未变则不写）。 */
  record: (point: RatingHistoryPoint) => Promise<boolean>;
  clear: () => Promise<void>;
}

export const useRatingHistoryStore = create<RatingHistoryState>((set, get) => ({
  points: [],
  updatedAt: undefined,
  loaded: false,

  load: async () => {
    try {
      const history = parseRatingHistory(await AsyncStorage.getItem(RATING_HISTORY_STORAGE_KEY));
      set({ points: history.points, updatedAt: history.updatedAt, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  record: async point => {
    // 以存储中的最新内容为准，避免 load 尚未完成时覆盖已有历史。
    const stored = get().loaded
      ? { points: get().points, updatedAt: get().updatedAt }
      : parseRatingHistory(await AsyncStorage.getItem(RATING_HISTORY_STORAGE_KEY));
    const next = appendRatingPoint(stored, point);
    if (!next) {
      if (!get().loaded) set({ points: stored.points, updatedAt: stored.updatedAt, loaded: true });
      return false;
    }
    await AsyncStorage.setItem(RATING_HISTORY_STORAGE_KEY, JSON.stringify(next));
    set({ points: next.points, updatedAt: next.updatedAt, loaded: true });
    return true;
  },

  clear: async () => {
    await AsyncStorage.removeItem(RATING_HISTORY_STORAGE_KEY);
    set({ points: [], updatedAt: undefined });
  },
}));
