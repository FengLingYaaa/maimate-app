/**
 * 拟合 50（v1.15.0）：按拟合定数（chart_stats 的 fit_diff）计算的 Rating 排名。
 *
 * 与 B50 的差异：
 * - 不分新曲/旧曲池，全库单榜（排除宴会场与无 fit_diff 的谱面）；
 * - 单谱 Rating = floor(fit_diff × achievement/100 × coefficient(achievement))，
 *   与官方公式同构，只是把官方定数 ds 换成拟合定数；
 * - 只统计有成绩的谱面；取最高 50 张。
 * 纯函数实现，node 回归脚本可直接运行。
 */

import type { ChartStatsMap, MusicData, PlayerScore } from './types';
import { calculateRating } from './rating';

export const FIT50_SIZE = 50;

/** 与 b50.achievementTier 相同的三档着色口径，此处独立导出避免循环依赖。 */
export type FitAchievementTier = 'gold' | 'green' | 'default';

export function fitAchievementTier(achievement: number): FitAchievementTier {
  if (achievement >= 100.5) return 'gold';
  if (achievement >= 100) return 'green';
  return 'default';
}

export interface Fit50Entry {
  /** 总排名（1 起，Rating 降序，同分按定数降序、曲名稳定排序）。 */
  rank: number;
  /** 单谱拟合 Rating。 */
  rating: number;
  /** 拟合定数（chart_stats fit_diff）。 */
  fitDiff: number;
  achievement: number;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
}

interface Fit50Result {
  entries: Fit50Entry[];
  /** 前 50 名 Rating 合计。 */
  total: number;
  /** 有 fit_diff 数据的谱面数（0 表示 chart_stats 未加载）。 */
  chartsWithFitDiff: number;
}

/**
 * 计算拟合 50。
 * @param chartStatsMap 形如 chartStats[songId][difficultyIndex] = ChartStats
 */
export function computeFit50(
  rawData: MusicData[],
  scores: PlayerScore[],
  chartStatsMap: ChartStatsMap,
): Fit50Result {
  const fitDiffOf = (songId: string, difficultyIndex: number): number | undefined =>
    chartStatsMap[songId]?.[difficultyIndex]?.fit_diff;

  let chartsWithFitDiff = 0;
  const rows: Fit50Entry[] = [];
  for (const score of scores) {
    const fitDiff = fitDiffOf(score.songId, score.difficultyIndex);
    if (fitDiff === undefined || !Number.isFinite(fitDiff) || fitDiff <= 0) continue;
    chartsWithFitDiff += 1;
    const rating = calculateRating(fitDiff, score.achievement);
    if (rating === null) continue;
    const music = rawData.find(candidate => candidate.id === score.songId && candidate.type === score.type);
    rows.push({
      rank: 0,
      rating,
      fitDiff,
      achievement: score.achievement,
      songId: score.songId,
      musicType: score.type,
      difficultyIndex: score.difficultyIndex,
      title: music?.title ?? score.title ?? score.songId,
    });
  }

  rows.sort((left, right) =>
    right.rating - left.rating
    || right.fitDiff - left.fitDiff
    || left.songId.localeCompare(right.songId)
    || left.difficultyIndex - right.difficultyIndex);
  const entries = rows.slice(0, FIT50_SIZE).map((row, index) => ({ ...row, rank: index + 1 }));
  const total = entries.reduce((sum, entry) => sum + entry.rating, 0);
  return { entries, total, chartsWithFitDiff };
}

/** 拟合 50 池内按其它维度排序（页面排序切换用）。 */
export type Fit50Sort = 'rating' | 'fitDiff';

export function sortFit50Entries(entries: Fit50Entry[], sort: Fit50Sort): Fit50Entry[] {
  const sorted = [...entries];
  if (sort === 'fitDiff') {
    sorted.sort((left, right) => right.fitDiff - left.fitDiff || left.rank - right.rank);
  }
  return sorted;
}
