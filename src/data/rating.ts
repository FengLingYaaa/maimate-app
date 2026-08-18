/**
 * 官方 DX Rating 和基于拟合定数的 Rating 计算。
 *
 * fit_diff 来自 Diving-Fish /chart_stats；它不是官方定数，
 * 因此界面会明确区分官方 Rating 与拟合 Rating。
 */

export const RATING_CHECKPOINTS = [50, 60, 70, 75, 80, 90, 94, 97, 98, 99, 99.5, 100, 100.5] as const;

/** 当前 DX Rating 完成率系数。 */
export function getRatingFactor(achievement: number): number {
  if (achievement < 50) return 7.0;
  if (achievement < 60) return 8.0;
  if (achievement < 70) return 9.6;
  if (achievement < 75) return 11.2;
  if (achievement < 80) return 12.0;
  if (achievement < 90) return 13.6;
  if (achievement < 94) return 15.2;
  if (achievement < 97) return 16.8;
  if (achievement < 98) return 20.0;
  if (achievement < 99) return 20.3;
  if (achievement < 99.5) return 20.8;
  if (achievement < 100) return 21.1;
  if (achievement < 100.5) return 21.6;
  return 22.4;
}

export function calculateRating(ds: number | undefined, achievement: number): number | null {
  if (ds === undefined || !Number.isFinite(ds) || !Number.isFinite(achievement)) return null;
  const clampedAchievement = Math.max(0, Math.min(100.5, achievement));
  return Math.floor(ds * (clampedAchievement / 100) * getRatingFactor(clampedAchievement));
}