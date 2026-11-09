/**
 * v1.19.0「本次同步战报」（纯函数，node 可测）。
 *
 * - 只在 syncScores 成功后生成；首次同步（本机此前没有成绩）只返回 baseline。
 * - 每次与上一次同步对比，只保留最新一次（存 AsyncStorage `maimate.last-sync-report.v1`）。
 * - 单曲贡献用 snapshot-battle.ts 的增量 B50 计算器（createB50ImpactCalculator）：
 *   该谱面换回旧成绩后 B50 总分少多少 = 本次它带来的 Rating 变化。不新增成绩字段。
 * - 只显示本次有变化、且对 B50 有影响的谱面；B50 外的变化不进战报。
 */

import { computeB50, type B50Entry } from './b50';
import { createB50ImpactCalculator } from './snapshot-battle';
import type { MusicData, PlayerScore } from './types';

export const SYNC_REPORT_STORAGE_KEY = 'maimate.last-sync-report.v1';

export interface SyncReportRow {
  chartKey: string;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  before: number | null;
  after: number;
  /** 对 B50 总分的影响（本地增量计算）。 */
  ratingDelta: number;
}

export interface SyncReportEntryRef {
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  rating: number;
  pool: 'new' | 'old';
}

export interface SyncReport {
  kind: 'baseline' | 'report';
  syncedAt: number;
  /** 标题用 Rating：前后两次都有服务器 Rating 时用服务器值，否则用本地 B50 总分。 */
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  ratingSource: 'server' | 'local';
  b50Before: number;
  b50After: number;
  /** B50 平均单曲 Rating（总分 / 入榜谱面数），保留两位。 */
  b50AverageBefore: number;
  b50AverageAfter: number;
  /** 本次推分贡献 Top 3（按 Rating 变化降序）。 */
  topContributions: SyncReportRow[];
  /** 对 B50 有正向贡献的谱面数。 */
  contributingCount: number;
  entered: SyncReportEntryRef[];
  left: SyncReportEntryRef[];
  /** B50 页未读横幅是否已看过。 */
  seen: boolean;
}

function chartKeyOf(songId: string, type: string, difficultyIndex: number): string {
  // 与 snapshot-battle.ts impactOf 的键格式一致。
  return `${songId}:${type}:${difficultyIndex}`;
}

function average(total: number, count: number): number {
  return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
}

function refOf(entry: B50Entry): SyncReportEntryRef {
  return { songId: entry.songId, musicType: entry.musicType, difficultyIndex: entry.difficultyIndex, title: entry.title, rating: entry.rating, pool: entry.pool };
}

export interface BuildSyncReportInput {
  rawData: MusicData[];
  previousScores: PlayerScore[];
  currentScores: PlayerScore[];
  previousServerRating: number | null;
  currentServerRating: number | null;
  syncedAt: number;
}

export function buildSyncReport(input: BuildSyncReportInput): SyncReport {
  const { rawData, previousScores, currentScores, syncedAt } = input;
  const beforeB50 = computeB50(rawData, previousScores);
  const afterB50 = computeB50(rawData, currentScores);
  const useServer = input.previousServerRating !== null && input.currentServerRating !== null;
  const ratingBefore = useServer ? (input.previousServerRating as number) : beforeB50.total;
  const ratingAfter = useServer ? (input.currentServerRating as number) : afterB50.total;
  const base: SyncReport = {
    kind: previousScores.length === 0 ? 'baseline' : 'report',
    syncedAt,
    ratingBefore,
    ratingAfter,
    ratingDelta: ratingAfter - ratingBefore,
    ratingSource: useServer ? 'server' : 'local',
    b50Before: beforeB50.total,
    b50After: afterB50.total,
    b50AverageBefore: average(beforeB50.total, beforeB50.entries.length),
    b50AverageAfter: average(afterB50.total, afterB50.entries.length),
    topContributions: [],
    contributingCount: 0,
    entered: [],
    left: [],
    seen: false,
  };
  if (base.kind === 'baseline') return base;

  const previousByKey = new Map(previousScores.map(score => [chartKeyOf(score.songId, score.type, score.difficultyIndex), score]));
  const { musicByKey, impactOf } = createB50ImpactCalculator(rawData, currentScores);
  const rows: SyncReportRow[] = [];
  for (const score of currentScores) {
    const key = chartKeyOf(score.songId, score.type, score.difficultyIndex);
    const before = previousByKey.get(key) ?? null;
    if (before && before.achievement === score.achievement) continue;
    const ratingDelta = impactOf(key, before);
    if (ratingDelta === 0) continue; // B50 外的变化不进战报。
    const music = musicByKey.get(`${score.songId}:${score.type}`);
    rows.push({
      chartKey: key,
      songId: score.songId,
      musicType: score.type,
      difficultyIndex: score.difficultyIndex,
      title: music?.title ?? score.title ?? score.songId,
      before: before ? before.achievement : null,
      after: score.achievement,
      ratingDelta,
    });
  }
  rows.sort((left, right) => right.ratingDelta - left.ratingDelta || left.title.localeCompare(right.title));

  const entryKey = (entry: B50Entry) => chartKeyOf(entry.songId, entry.musicType, entry.difficultyIndex);
  const beforeKeys = new Set(beforeB50.entries.map(entryKey));
  const afterKeys = new Set(afterB50.entries.map(entryKey));
  return {
    ...base,
    topContributions: rows.filter(row => row.ratingDelta > 0).slice(0, 3),
    contributingCount: rows.filter(row => row.ratingDelta > 0).length,
    entered: afterB50.entries.filter(entry => !beforeKeys.has(entryKey(entry))).map(refOf),
    left: beforeB50.entries.filter(entry => !afterKeys.has(entryKey(entry))).map(refOf),
  };
}

/** Toast 文案：Rating 上涨时才有；没涨返回 null（不弹）。 */
export function syncReportToast(report: SyncReport | null): string | null {
  if (!report || report.kind !== 'report' || report.ratingDelta <= 0) return null;
  const top = report.topContributions[0];
  if (!top) return `Rating +${report.ratingDelta}`;
  return report.contributingCount > 1
    ? `Rating +${report.ratingDelta}，本次推分主要来自 ${top.title} 等 ${report.contributingCount} 首`
    : `Rating +${report.ratingDelta}，本次推分来自 ${top.title}`;
}

/** B50 页未读横幅文案；没有可显示的变化返回 null。 */
export function syncReportBanner(report: SyncReport | null): string | null {
  if (!report || report.kind !== 'report' || report.seen) return null;
  if (report.ratingDelta === 0 && report.contributingCount === 0) return null;
  const sign = report.ratingDelta > 0 ? `+${report.ratingDelta}` : String(report.ratingDelta);
  return report.contributingCount > 0
    ? `本次同步 Rating ${sign}，来自 ${report.contributingCount} 首新成绩`
    : `本次同步 Rating ${sign}`;
}

export function parseSyncReport(raw: string | null): SyncReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SyncReport;
    if (!parsed || (parsed.kind !== 'report' && parsed.kind !== 'baseline') || !Number.isFinite(parsed.syncedAt)) return null;
    return {
      ...parsed,
      topContributions: Array.isArray(parsed.topContributions) ? parsed.topContributions : [],
      entered: Array.isArray(parsed.entered) ? parsed.entered : [],
      left: Array.isArray(parsed.left) ? parsed.left : [],
      seen: Boolean(parsed.seen),
    };
  } catch {
    return null;
  }
}
