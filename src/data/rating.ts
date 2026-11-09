/**
 * Diving-Fish 当前使用的 DX Rating 计算。
 *
 * 公式：floor(ds × min(achievement, 100.5) / 100 × coefficient)
 *
 * 服务器在 80%、97%、99%、100% 等边界前保留了额外的系数段，
 * 不能只用一个“约等于”的区间表，否则低分成绩可能出现明显偏差。
 */

export const RATING_CHECKPOINTS = [50, 60, 70, 75, 80, 90, 94, 97, 98, 99, 99.5, 100, 100.5] as const;

interface RatingCoefficient {
  minAchievement: number;
  coefficient: number;
}

const RATING_COEFFICIENTS: readonly RatingCoefficient[] = [
  { minAchievement: 0, coefficient: 0 },
  { minAchievement: 10, coefficient: 1.6 },
  { minAchievement: 20, coefficient: 3.2 },
  { minAchievement: 30, coefficient: 4.8 },
  { minAchievement: 40, coefficient: 6.4 },
  { minAchievement: 50, coefficient: 8.0 },
  { minAchievement: 60, coefficient: 9.6 },
  { minAchievement: 70, coefficient: 11.2 },
  { minAchievement: 75, coefficient: 12.0 },
  { minAchievement: 79.9999, coefficient: 12.8 },
  { minAchievement: 80, coefficient: 13.6 },
  { minAchievement: 90, coefficient: 15.2 },
  { minAchievement: 94, coefficient: 16.8 },
  { minAchievement: 96.9999, coefficient: 17.6 },
  { minAchievement: 97, coefficient: 20.0 },
  { minAchievement: 98, coefficient: 20.3 },
  { minAchievement: 98.9999, coefficient: 20.6 },
  { minAchievement: 99, coefficient: 20.8 },
  { minAchievement: 99.5, coefficient: 21.1 },
  { minAchievement: 99.9999, coefficient: 21.4 },
  { minAchievement: 100, coefficient: 21.6 },
  { minAchievement: 100.4999, coefficient: 22.2 },
  { minAchievement: 100.5, coefficient: 22.4 },
] as const;

/** 当前 DX Rating 完成率系数。 */
export function getRatingFactor(achievement: number): number {
  if (!Number.isFinite(achievement)) return 0;
  const clampedAchievement = Math.max(0, Math.min(100.5, achievement));
  for (let index = 0; index < RATING_COEFFICIENTS.length; index += 1) {
    const current = RATING_COEFFICIENTS[index];
    const next = RATING_COEFFICIENTS[index + 1];
    if (!next || clampedAchievement < next.minAchievement) return current.coefficient;
  }
  return RATING_COEFFICIENTS[RATING_COEFFICIENTS.length - 1].coefficient;
}

export function calculateRating(ds: number | undefined, achievement: number): number | null {
  if (ds === undefined || !Number.isFinite(ds) || !Number.isFinite(achievement)) return null;
  const clampedAchievement = Math.max(0, Math.min(100.5, achievement));
  return Math.floor(ds * (clampedAchievement / 100) * getRatingFactor(clampedAchievement));
}

/** 目标达成率的输入边界；成绩接口可能返回 101，但 Rating 在 100.5 封顶。 */
export const MIN_ACHIEVEMENT = 0;
export const MAX_ACHIEVEMENT_INPUT = 101;
export const MAX_ACHIEVEMENT_FOR_RATING = 100.5;

export function normalizeAchievement(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10000) / 10000;
  if (rounded < MIN_ACHIEVEMENT || rounded > MAX_ACHIEVEMENT_INPUT) return null;
  return rounded;
}

export function formatAchievement(value: number): string {
  return `${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

export function getRatingCoefficientTable(): readonly RatingCoefficient[] {
  return RATING_COEFFICIENTS;
}

/**
 * v1.19.0：DX Rating 段位（颜色档）表。下限含本身；15000 以上为彩框，之后按每 100 分一档推荐。
 * 注：阈值按 maimai DX 现行底板颜色档整理，如游戏调整以游戏内为准。
 */
export interface RatingTier {
  min: number;
  name: string;
}

export const DX_RATING_TIERS: readonly RatingTier[] = [
  { min: 0, name: '白' },
  { min: 1000, name: '蓝' },
  { min: 2000, name: '绿' },
  { min: 4000, name: '黄' },
  { min: 7000, name: '红' },
  { min: 10000, name: '紫' },
  { min: 12000, name: '铜' },
  { min: 13000, name: '银' },
  { min: 14000, name: '金' },
  { min: 14500, name: '白金' },
  { min: 15000, name: '彩' },
] as const;

export function getRatingTier(rating: number): RatingTier {
  let current = DX_RATING_TIERS[0];
  for (const tier of DX_RATING_TIERS) if (rating >= tier.min) current = tier;
  return current;
}

/** 下一档目标：还没到彩框时取下一个颜色档；彩框之后取下一个整百。 */
export function getNextRatingTarget(rating: number): { target: number; label: string } {
  const next = DX_RATING_TIERS.find(tier => tier.min > rating);
  if (next) return { target: next.min, label: `${next.name}框 ${next.min}` };
  const target = (Math.floor(rating / 100) + 1) * 100;
  return { target, label: `${target}` };
}
