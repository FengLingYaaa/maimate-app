/**
 * v1.19.0 定数变更提醒 store：曲库加载时保存上一次定数（基线），与新曲库 diff 后留存最近一次变更报告。
 *
 * - 基线：AsyncStorage `maimate.level-baseline.v1`；报告：`maimate.level-change-report.v1`。
 * - 首次（没有基线）只保存基线，不提醒；数据异常（>30% 谱面同时变化、定数缺失）不提醒也不更新基线。
 * - 报告只存原始变更；「对 B50 有没有影响」在 B50 页用当前成绩实时计算（computeLevelImpact），
 *   没有影响就不显示卡片——平时不提醒。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { buildLevelBaseline, diffLevels, type LevelBaseline, type LevelChange } from './level-change';
import type { MusicData } from './types';

export const LEVEL_BASELINE_KEY = 'maimate.level-baseline.v1';
export const LEVEL_REPORT_KEY = 'maimate.level-change-report.v1';

export interface LevelChangeReport {
  detectedAt: number;
  levelChanges: LevelChange[];
  addedSongs: Array<{ key: string; title: string }>;
  removedSongs: Array<{ key: string; title: string }>;
  seen: boolean;
}

interface LevelState {
  report: LevelChangeReport | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** 曲库加载/更新后调用：与基线 diff，更新基线与报告。 */
  checkMusicData: (rawData: MusicData[]) => Promise<void>;
  markSeen: () => Promise<void>;
}

function parseBaseline(raw: string | null): LevelBaseline | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LevelBaseline;
    if (!parsed || typeof parsed.ds !== 'object' || typeof parsed.songs !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseReport(raw: string | null): LevelChangeReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LevelChangeReport;
    if (!parsed || !Array.isArray(parsed.levelChanges)) return null;
    return { ...parsed, addedSongs: parsed.addedSongs ?? [], removedSongs: parsed.removedSongs ?? [], seen: Boolean(parsed.seen) };
  } catch {
    return null;
  }
}

let checking: Promise<void> | null = null;

export const useLevelStore = create<LevelState>((set, get) => ({
  report: null,
  loaded: false,

  load: async () => {
    try {
      const stored = parseReport(await AsyncStorage.getItem(LEVEL_REPORT_KEY));
      // 曲库检测可能先于 load 完成：以较新的报告为准。
      const current = get().report;
      set({ report: current && (!stored || current.detectedAt >= stored.detectedAt) ? current : stored, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  checkMusicData: async rawData => {
    if (rawData.length === 0) return;
    if (checking) await checking;
    checking = (async () => {
      try {
        const baseline = parseBaseline(await AsyncStorage.getItem(LEVEL_BASELINE_KEY));
        if (!baseline) {
          await AsyncStorage.setItem(LEVEL_BASELINE_KEY, JSON.stringify(buildLevelBaseline(rawData)));
          return;
        }
        const diff = diffLevels(baseline, rawData);
        if (diff.anomaly) return;
        if (diff.levelChanges.length === 0 && diff.addedSongs.length === 0 && diff.removedSongs.length === 0) return;
        const report: LevelChangeReport = {
          detectedAt: Date.now(),
          levelChanges: diff.levelChanges,
          addedSongs: diff.addedSongs,
          removedSongs: diff.removedSongs.map(song => ({ ...song, title: baseline.songs[song.key] ?? song.title })),
          seen: false,
        };
        await AsyncStorage.multiSet([
          [LEVEL_REPORT_KEY, JSON.stringify(report)],
          [LEVEL_BASELINE_KEY, JSON.stringify(buildLevelBaseline(rawData))],
        ]);
        set({ report, loaded: true });
      } catch {
        // 提醒只是附加信息。
      }
    })();
    await checking;
    checking = null;
  },

  markSeen: async () => {
    const report = get().report;
    if (!report || report.seen) return;
    const next = { ...report, seen: true };
    set({ report: next });
    try {
      await AsyncStorage.setItem(LEVEL_REPORT_KEY, JSON.stringify(next));
    } catch {
      // 忽略。
    }
  },
}));
