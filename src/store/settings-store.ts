import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, DetailBoardConfig, DetailBoardId } from '../data/types';
import { CACHE_KEYS } from '../constants/game';

/** 详情页板块默认顺序与折叠：Rating 预估 / 完成率损失默认收起。 */
export const DEFAULT_DETAIL_BOARDS: Record<DetailBoardId, DetailBoardConfig> = {
  rating: { order: 0, collapsed: true },
  achievement: { order: 1, collapsed: true },
  bilibili: { order: 2, collapsed: false },
  platform: { order: 3, collapsed: false },
};

export const DETAIL_BOARD_LABELS: Record<DetailBoardId, string> = {
  rating: 'DX Rating 预估',
  achievement: '完成率损失',
  bilibili: 'B 站搜索 / 手元',
  platform: '音乐平台搜索',
};

export const DEFAULT_SETTINGS: AppSettings = {
  showChinaVersion: true,
  defaultSort: { mode: 'relevance', difficultyIndex: 3 },
  showProjectedRating: true,
  defaultMusicPlatform: 'netease',
  musicAppSearchFirst: true,
  detailBoards: DEFAULT_DETAIL_BOARDS,
};

function mergeDetailBoards(parsed: Partial<AppSettings> | undefined): Record<DetailBoardId, DetailBoardConfig> {
  const result = {} as Record<DetailBoardId, DetailBoardConfig>;
  for (const id of Object.keys(DEFAULT_DETAIL_BOARDS) as DetailBoardId[]) {
    result[id] = { ...DEFAULT_DETAIL_BOARDS[id], ...(parsed?.detailBoards?.[id] || {}) };
  }
  return result;
}

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
