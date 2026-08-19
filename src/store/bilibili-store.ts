import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BilibiliVideoLink } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import {
  getBilibiliLinkChartKey,
  getChartKey,
  getNewBilibiliLinkId,
  normalizeBilibiliVideoUrl,
  parseBilibiliShare,
} from '../data/bilibili-links';
import {
  downloadBilibiliCover,
  fetchBilibiliMetadata,
  removeBilibiliCover,
  removeBilibiliCoversForLink,
} from '../data/bilibili-metadata';

interface BilibiliStore {
  links: BilibiliVideoLink[];
  loaded: boolean;
  loadLinks: () => Promise<void>;
  addLink: (input: Omit<BilibiliVideoLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BilibiliVideoLink>;
  updateLink: (id: string, patch: Partial<Pick<BilibiliVideoLink, 'url' | 'remark' | 'tags' | 'shareTitle'>>) => Promise<void>;
  refreshMetadata: (id: string) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  getLinksForChart: (songId: string, musicType: 'SD' | 'DX', difficultyIndex: number) => BilibiliVideoLink[];
}

async function persist(links: BilibiliVideoLink[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.bilibiliLinks, JSON.stringify(links));
}

function normalizeLoadedLink(value: unknown): BilibiliVideoLink | null {
  if (!value || typeof value !== 'object') return null;
  const link = value as Partial<BilibiliVideoLink>;
  if (!link.id || !link.songId || !link.url || !Array.isArray(link.tags)) return null;
  const url = normalizeBilibiliVideoUrl(link.url);
  if (!url || (link.musicType !== 'SD' && link.musicType !== 'DX') || typeof link.difficultyIndex !== 'number') return null;
  return {
    ...(link as BilibiliVideoLink),
    url,
    remark: typeof link.remark === 'string' ? link.remark : '',
    tags: link.tags.map(tag => String(tag).trim()).filter(Boolean),
    metadataStatus: link.metadataStatus === 'success' || link.metadataStatus === 'partial' || link.metadataStatus === 'error'
      ? link.metadataStatus
      : 'idle',
  };
}

export const useBilibiliStore = create<BilibiliStore>((set, get) => ({
  links: [],
  loaded: false,

  loadLinks: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.bilibiliLinks);
      const parsed = raw ? JSON.parse(raw) : [];
      const links = Array.isArray(parsed)
        ? parsed.map(normalizeLoadedLink).filter((link): link is BilibiliVideoLink => link !== null)
        : [];
      set({ links, loaded: true });
    } catch {
      set({ links: [], loaded: true });
    }
  },

  addLink: async input => {
    const parsed = parseBilibiliShare(input.url);
    const url = normalizeBilibiliVideoUrl(input.url);
    if (!url) throw new Error('请输入有效的 Bilibili 视频分享链接');
    const now = Date.now();
    const link: BilibiliVideoLink = {
      ...input,
      id: getNewBilibiliLinkId(),
      url,
      shareTitle: input.shareTitle?.trim() || parsed?.title,
      remark: input.remark.trim(),
      tags: [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))],
      metadataStatus: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    const links = [...get().links, link];
    set({ links });
    await persist(links);
    return link;
  },

  updateLink: async (id, patch) => {
    const current = get().links.find(link => link.id === id);
    if (!current) return;
    const parsed = patch.url ? parseBilibiliShare(patch.url) : null;
    const normalizedUrl = patch.url === undefined ? current.url : normalizeBilibiliVideoUrl(patch.url);
    if (!normalizedUrl) throw new Error('请输入有效的 Bilibili 视频分享链接');
    const urlChanged = normalizedUrl !== current.url;
    // Clear every legacy and source-keyed cover before changing the URL. This prevents an
    // in-flight metadata request for the old URL from leaving a reusable stale file behind.
    if (urlChanged) await removeBilibiliCoversForLink(id);
    const links = get().links.map(link => {
      if (link.id !== id) return link;
      return {
        ...link,
        ...patch,
        url: normalizedUrl,
        shareTitle: patch.shareTitle === undefined ? (parsed?.title || (urlChanged ? undefined : link.shareTitle)) : patch.shareTitle.trim(),
        title: urlChanged ? undefined : link.title,
        coverUri: urlChanged ? undefined : link.coverUri,
        coverSourceUrl: urlChanged ? undefined : link.coverSourceUrl,
        metadataStatus: urlChanged ? 'idle' as const : link.metadataStatus,
        remark: patch.remark === undefined ? link.remark : patch.remark.trim(),
        tags: patch.tags === undefined ? link.tags : [...new Set(patch.tags.map(tag => tag.trim()).filter(Boolean))],
        updatedAt: Date.now(),
      };
    });
    set({ links });
    await persist(links);
  },

  refreshMetadata: async id => {
    const current = get().links.find(link => link.id === id);
    if (!current) return;
    const requestUrl = current.url;
    const loading = get().links.map(link => link.id === id ? { ...link, metadataStatus: 'loading' as const } : link);
    set({ links: loading });
    await persist(loading);
    try {
      const metadata = await fetchBilibiliMetadata(requestUrl);
      const latest = get().links.find(link => link.id === id);
      // Editing or deleting a link invalidates any metadata request started for its old URL.
      if (!latest || latest.url !== requestUrl) return;
      const coverChanged = Boolean(latest.coverUri && latest.coverSourceUrl && metadata.coverUrl && latest.coverSourceUrl !== metadata.coverUrl);
      if (coverChanged) await removeBilibiliCover(latest.coverUri);
      const downloadedCoverUri = metadata.coverUrl
        ? await downloadBilibiliCover(id, metadata.coverUrl).catch(() => undefined)
        : latest.coverUri;
      const afterDownload = get().links.find(link => link.id === id);
      if (!afterDownload || afterDownload.url !== requestUrl) {
        if (downloadedCoverUri && downloadedCoverUri !== afterDownload?.coverUri) await removeBilibiliCover(downloadedCoverUri);
        return;
      }
      const nextCoverUri = coverChanged ? downloadedCoverUri : (downloadedCoverUri || afterDownload.coverUri);
      const next = get().links.map(link => link.id === id ? {
        ...link,
        title: metadata.title || link.title,
        coverUri: nextCoverUri,
        coverSourceUrl: metadata.coverUrl || link.coverSourceUrl,
        metadataStatus: metadata.title || nextCoverUri ? 'success' as const : 'partial' as const,
        metadataFetchedAt: Date.now(),
        updatedAt: Date.now(),
      } : link);
      set({ links: next });
      await persist(next);
    } catch {
      const latest = get().links.find(link => link.id === id);
      if (!latest || latest.url !== requestUrl) return;
      const next = get().links.map(link => link.id === id ? {
        ...link,
        metadataStatus: 'error' as const,
        metadataFetchedAt: Date.now(),
        updatedAt: Date.now(),
      } : link);
      set({ links: next });
      await persist(next);
    }
  },

  removeLink: async id => {
    const links = get().links.filter(link => link.id !== id);
    set({ links });
    await persist(links);
    await removeBilibiliCoversForLink(id);
  },

  getLinksForChart: (songId, musicType, difficultyIndex) => {
    const chartKey = getChartKey(songId, musicType, difficultyIndex);
    return get().links.filter(link => getBilibiliLinkChartKey(link) === chartKey);
  },
}));
