import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BilibiliVideoLink } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import { getBilibiliLinkChartKey, getChartKey, getNewBilibiliLinkId, normalizeBilibiliVideoUrl } from '../data/bilibili-links';

interface BilibiliStore {
  links: BilibiliVideoLink[];
  loaded: boolean;
  loadLinks: () => Promise<void>;
  addLink: (input: Omit<BilibiliVideoLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BilibiliVideoLink>;
  updateLink: (id: string, patch: Partial<Pick<BilibiliVideoLink, 'url' | 'remark' | 'tags'>>) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  getLinksForChart: (songId: string, musicType: 'SD' | 'DX', difficultyIndex: number) => BilibiliVideoLink[];
}

async function persist(links: BilibiliVideoLink[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.bilibiliLinks, JSON.stringify(links));
}

export const useBilibiliStore = create<BilibiliStore>((set, get) => ({
  links: [],
  loaded: false,

  loadLinks: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.bilibiliLinks);
      const links = raw ? JSON.parse(raw) : [];
      set({ links: Array.isArray(links) ? links : [], loaded: true });
    } catch {
      set({ links: [], loaded: true });
    }
  },

  addLink: async input => {
    const url = normalizeBilibiliVideoUrl(input.url);
    if (!url) throw new Error('请输入有效的 Bilibili 视频分享链接');
    const now = Date.now();
    const link: BilibiliVideoLink = {
      ...input,
      id: getNewBilibiliLinkId(),
      url,
      remark: input.remark.trim(),
      tags: [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))],
      createdAt: now,
      updatedAt: now,
    };
    const links = [...get().links, link];
    set({ links });
    await persist(links);
    return link;
  },

  updateLink: async (id, patch) => {
    const links = get().links.map(link => {
      if (link.id !== id) return link;
      const normalizedUrl = patch.url === undefined ? link.url : normalizeBilibiliVideoUrl(patch.url);
      if (!normalizedUrl) throw new Error('请输入有效的 Bilibili 视频分享链接');
      return {
        ...link,
        ...patch,
        url: normalizedUrl,
        remark: patch.remark === undefined ? link.remark : patch.remark.trim(),
        tags: patch.tags === undefined ? link.tags : [...new Set(patch.tags.map(tag => tag.trim()).filter(Boolean))],
        updatedAt: Date.now(),
      };
    });
    set({ links });
    await persist(links);
  },

  removeLink: async id => {
    const links = get().links.filter(link => link.id !== id);
    set({ links });
    await persist(links);
  },

  getLinksForChart: (songId, musicType, difficultyIndex) => {
    const chartKey = getChartKey(songId, musicType, difficultyIndex);
    return get().links.filter(link => getBilibiliLinkChartKey(link) === chartKey);
  },
}));
