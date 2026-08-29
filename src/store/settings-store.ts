import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import { DEFAULT_SETTINGS, mergeDetailBoards, normalizeSnapshotLimit } from '../data/settings-defaults';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

async function persist(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.settings, JSON.stringify(settings));
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.settings);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            defaultSort: { ...DEFAULT_SETTINGS.defaultSort, ...(parsed.defaultSort || {}) },
            detailBoards: mergeDetailBoards(parsed),
            snapshotLimit: normalizeSnapshotLimit(parsed.snapshotLimit),
            autoSinkAchieved: parsed.autoSinkAchieved !== false,
          },
          loaded: true,
        });
        return;
      }
    } catch {
      // 使用默认设置，不阻塞应用启动。
    }
    set({ settings: DEFAULT_SETTINGS, loaded: true });
  },

  updateSettings: async patch => {
    const settings: AppSettings = {
      ...get().settings,
      ...patch,
      defaultSort: { ...get().settings.defaultSort, ...(patch.defaultSort || {}) },
      ...(patch.snapshotLimit !== undefined ? { snapshotLimit: normalizeSnapshotLimit(patch.snapshotLimit) } : {}),
    };
    set({ settings });
    try {
      await persist(settings);
    } catch {
      // 设置已在本次运行生效；下次启动会回退到之前的持久值。
    }
  },

  resetSettings: async () => {
    set({ settings: DEFAULT_SETTINGS });
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.settings);
    } catch {
      // 忽略清理失败。
    }
  },
}));
