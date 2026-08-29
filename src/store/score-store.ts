import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerProfile, PlayerScore, ScoreChange, ScoreSnapshot, ScoreSyncState } from '../data/types';
import { CACHE_KEYS } from '../constants/game';
import { getChartKey } from '../data/bilibili-links';
import {
  deleteImportToken,
  extractImportToken,
  fetchImportedScores,
  readStoredImportToken,
  saveImportToken,
  validateImportToken,
} from '../api/score-import';
import { useSettingsStore } from './settings-store';
import { usePlanStore } from './plan-store';
import { normalizeSnapshotLimit } from '../data/settings-defaults';

interface StoredScorePayload {
  scores: PlayerScore[];
  sync: ScoreSyncState;
  profile?: PlayerProfile;
}

interface ScoreStore {
  scores: PlayerScore[];
  profile: PlayerProfile | null;
  sync: ScoreSyncState;
  snapshots: ScoreSnapshot[];
  changes: ScoreChange[];
  loaded: boolean;
  tokenConfigured: boolean;
  loadScores: () => Promise<void>;
  /** v1.13.0：删除指定快照（快照管理 UI 使用），持久化同步更新。 */
  deleteSnapshot: (snapshotId: string) => Promise<void>;
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
  changedCount: 0,
  message: null,
};

function getErrorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '成绩同步失败，请稍后重试';
}

function sameScore(left: PlayerScore | undefined, right: PlayerScore | undefined): boolean {
  if (!left || !right) return left === right;
  return left.achievement === right.achievement
    && left.dxScore === right.dxScore
    && left.fc === right.fc
    && left.fs === right.fs
    && left.serverRating === right.serverRating;
}

function diffScores(previous: PlayerScore[], current: PlayerScore[], changedAt: number): ScoreChange[] {
  const previousMap = new Map(previous.map(score => [getChartKey(score.songId, score.type, score.difficultyIndex), score]));
  const currentMap = new Map(current.map(score => [getChartKey(score.songId, score.type, score.difficultyIndex), score]));
  const keys = new Set([...previousMap.keys(), ...currentMap.keys()]);
  return [...keys]
    .filter(key => !sameScore(previousMap.get(key), currentMap.get(key)))
    .map(chartKey => ({
      chartKey,
      previous: previousMap.get(chartKey) || null,
      current: currentMap.get(chartKey) || null,
      changedAt,
    }));
}

async function persistPayload(payload: StoredScorePayload): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.scoreData, JSON.stringify(payload));
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  scores: [],
  profile: null,
  sync: initialSync,
  snapshots: [],
  changes: [],
  loaded: false,
  tokenConfigured: false,

  loadScores: async () => {
    let scores: PlayerScore[] = [];
    let sync = initialSync;
    let profile: PlayerProfile | null = null;
    let snapshots: ScoreSnapshot[] = [];
    let changes: ScoreChange[] = [];
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.scoreData);
      if (raw) {
        const payload = JSON.parse(raw) as Partial<StoredScorePayload>;
        if (Array.isArray(payload.scores)) scores = payload.scores as PlayerScore[];
        if (payload.sync && typeof payload.sync === 'object') sync = { ...initialSync, ...payload.sync, changedCount: Number(payload.sync.changedCount) || 0 };
        if (payload.profile && typeof payload.profile === 'object') profile = payload.profile as PlayerProfile;
      }
      const snapshotsRaw = await AsyncStorage.getItem(CACHE_KEYS.scoreSnapshots);
      if (snapshotsRaw) {
        const parsed = JSON.parse(snapshotsRaw);
        if (Array.isArray(parsed)) snapshots = parsed as ScoreSnapshot[];
      }
      const changesRaw = await AsyncStorage.getItem(CACHE_KEYS.scoreChanges);
      if (changesRaw) {
        const parsed = JSON.parse(changesRaw);
        if (Array.isArray(parsed)) changes = parsed as ScoreChange[];
      }
    } catch {
      scores = [];
      sync = { ...initialSync, message: '本地成绩缓存无法读取' };
      snapshots = [];
      changes = [];
    }

    let tokenConfigured = false;
    try {
      tokenConfigured = Boolean(await readStoredImportToken());
    } catch {
      tokenConfigured = false;
    }
    set({ scores, profile, sync, snapshots, changes, tokenConfigured, loaded: true });
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
      const syncedAt = Date.now();
      const previousScores = get().scores;
      const changed = diffScores(previousScores, result.scores, syncedAt);
      const snapshot: ScoreSnapshot = {
        id: `snapshot-${syncedAt}`,
        syncedAt,
        recordCount: result.scores.length,
        serverRating: result.serverRating,
        scores: result.scores,
      };
      // v1.15.0：快照保留数量由设置驱动（默认 20，可设至多 1000）。
      const snapshotLimit = normalizeSnapshotLimit(useSettingsStore.getState().settings.snapshotLimit);
      const snapshots = [snapshot, ...get().snapshots].slice(0, snapshotLimit);
      const changes = [...changed, ...get().changes].slice(0, 120);
      const sync: ScoreSyncState = {
        status: 'success',
        lastSyncedAt: syncedAt,
        recordCount: result.scores.length,
        serverRating: result.serverRating,
        changedCount: changed.length,
        message: null,
      };
      const payload: StoredScorePayload = { scores: result.scores, sync, profile: result.profile };
      await persistPayload(payload);
      await AsyncStorage.setItem(CACHE_KEYS.scoreSnapshots, JSON.stringify(snapshots));
      await AsyncStorage.setItem(CACHE_KEYS.scoreChanges, JSON.stringify(changes));
      set({ scores: result.scores, profile: result.profile, sync, snapshots, changes, tokenConfigured: true });
      // v1.16.2：同步后把「新达标」的计划条目沉底（设置可关）。
      // 判定：计划条目设了目标分，且该谱面成绩从 <目标 变为 ≥目标。
      if (useSettingsStore.getState().settings.autoSinkAchieved) {
        const planState = usePlanStore.getState();
        const changedMap = new Map(changes.map(change => [change.chartKey, change]));
        const sunkIds: string[] = [];
        for (const entry of planState.entries) {
          if (entry.targetScore === undefined) continue;
          const key = getChartKey(entry.songId, entry.musicType || 'SD', entry.difficultyIndex);
          const change = changedMap.get(key);
          if (!change) continue;
          const before = change.previous?.achievement;
          const after = change.current?.achievement;
          if (before === undefined || after === undefined) continue;
          if (before < entry.targetScore && after >= entry.targetScore) sunkIds.push(entry.entryId);
        }
        if (sunkIds.length > 0) planState.sinkAchievedEntries(sunkIds);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      const status = error && typeof error === 'object' && 'kind' in error && error.kind === 'invalid-token'
        ? 'invalid'
        : 'error';
      set({ sync: { ...get().sync, status, message } });
    }
  },

  clearScores: async () => {
    await AsyncStorage.multiRemove([CACHE_KEYS.scoreData, CACHE_KEYS.scoreSnapshots, CACHE_KEYS.scoreChanges]);
    set({ scores: [], profile: null, sync: initialSync, snapshots: [], changes: [] });
  },

  deleteSnapshot: async snapshotId => {
    const snapshots = get().snapshots.filter(snapshot => snapshot.id !== snapshotId);
    await AsyncStorage.setItem(CACHE_KEYS.scoreSnapshots, JSON.stringify(snapshots));
    set({ snapshots });
  },
}));
