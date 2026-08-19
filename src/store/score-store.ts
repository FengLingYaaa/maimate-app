import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerScore, ScoreSyncState } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import {
  deleteImportToken,
  extractImportToken,
  fetchImportedScores,
  readStoredImportToken,
  saveImportToken,
  validateImportToken,
} from '../api/score-import';

interface StoredScorePayload {
  scores: PlayerScore[];
  sync: ScoreSyncState;
}

interface ScoreStore {
  scores: PlayerScore[];
  sync: ScoreSyncState;
  loaded: boolean;
  tokenConfigured: boolean;
  loadScores: () => Promise<void>;
  verifyAndSaveToken: (value: string) => Promise<void>;
  clearToken: () => Promise<void>;
  syncScores: () => Promise<void>;
  clearScores: () => Promise<void>;
}

const initialSync: ScoreSyncState = {
  status: 'idle',
  lastSyncedAt: null,
  recordCount: 0,
  serverRating: null,
  message: null,
};

function getErrorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '成绩同步失败，请稍后重试';
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  scores: [],
  sync: initialSync,
  loaded: false,
  tokenConfigured: false,

  loadScores: async () => {
    let scores: PlayerScore[] = [];
    let sync = initialSync;
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.scoreData);
      if (raw) {
        const payload = JSON.parse(raw) as Partial<StoredScorePayload>;
        if (Array.isArray(payload.scores)) scores = payload.scores as PlayerScore[];
        if (payload.sync && typeof payload.sync === 'object') sync = { ...initialSync, ...payload.sync };
      }
    } catch {
      scores = [];
      sync = { ...initialSync, message: '本地成绩缓存无法读取' };
    }

    let tokenConfigured = false;
    try {
      tokenConfigured = Boolean(await readStoredImportToken());
    } catch {
      tokenConfigured = false;
    }
    set({ scores, sync, tokenConfigured, loaded: true });
  },

  verifyAndSaveToken: async value => {
    const token = extractImportToken(value);
    await validateImportToken(token);
    await saveImportToken(token);
    set({ tokenConfigured: true });
  },

  clearToken: async () => {
    await deleteImportToken();
    set({ tokenConfigured: false });
  },

  syncScores: async () => {
    const token = await readStoredImportToken();
    if (!token) {
      set({ sync: { ...get().sync, status: 'invalid', message: '请先保存并验证 Token' } });
      return;
    }

    set({ sync: { ...get().sync, status: 'syncing', message: null } });
    try {
      const result = await fetchImportedScores(token);
      const sync: ScoreSyncState = {
        status: 'success',
        lastSyncedAt: Date.now(),
        recordCount: result.scores.length,
        serverRating: result.serverRating,
        message: null,
      };
      const payload: StoredScorePayload = { scores: result.scores, sync };
      await AsyncStorage.setItem(CACHE_KEYS.scoreData, JSON.stringify(payload));
      set({ scores: result.scores, sync, tokenConfigured: true });
    } catch (error) {
      const message = getErrorMessage(error);
      const status = error && typeof error === 'object' && 'kind' in error && error.kind === 'invalid-token'
        ? 'invalid'
        : 'error';
      set({ sync: { ...get().sync, status, message } });
    }
  },

  clearScores: async () => {
    await AsyncStorage.removeItem(CACHE_KEYS.scoreData);
    set({ scores: [], sync: initialSync });
  },
}));
