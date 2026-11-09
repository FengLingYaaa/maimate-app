/**
 * v1.19.0「距下一档 Rating 还差什么」推荐（纯函数，node 可测）。
 *
 * - 目标：src/data/rating.ts 的段位表 getNextRatingTarget（彩框前取下一颜色档，之后取下一个整百）。
 * - 候选：music-list 的官方定数（getOfficialChartConstant，宴会场无定数自动排除）× score-store 同步成绩的达成率。
 * - 每张谱面只推荐一次：取「能让 B50 涨分的最低达成率档」（当前段位内最容易涨的一档）。
 * - 难度/定数过滤：只看定数落在「B50 最低定数 − 0.2 ~ B50 最高定数 + 0.6」的谱面；没玩过的谱面
 *   只推荐不高于「已 ≥99.5% 的最高定数 + 0.3」的；已 100.5% 的谱面不再出现。
 * - 容错提示复用 achievement-loss.ts：目标达成率下约可丢多少个 Tap GREAT（绝赞全 CP 口径）。
 * - 排序：B50 增益降序 → 定数与 B50 中位定数接近 → 所需提升幅度小。
 * - 增益口径与推分计划卡片一致：最终名单用 computeB50Gain 精确复核。
 */

import { computeAchievementLoss } from './achievement-loss';
import { B15_SIZE, B35_SIZE, buildB50Candidates, computeB50 } from './b50';
import { getOfficialChartConstant } from './music-list';
import { calculateRating, getNextRatingTarget } from './rating';
import type { MusicData, PlayerScore } from './types';

/** 推荐的目标达成率档（rating.ts RATING_CHECKPOINTS 中对 Rating 有意义的高档）。 */
export const TARGET_CHECKPOINTS = [97, 98, 99, 99.5, 100, 100.5] as const;
/** 已有成绩的谱面，一次最多推荐提升的达成率（百分点）。 */
export const MAX_ACHIEVEMENT_JUMP = 1.5;

export interface RatingTargetCandidate {
  key: string;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  ds: number;
  pool: 'new' | 'old';
  currentAchievement: number | null;
  targetAchievement: number;
  currentRating: number;
  targetRating: number;
  /** 单独达成后 B50 总分的增量（精确重算）。 */
  gain: number;
  inB50: boolean;
  inPlan: boolean;
  /** 目标达成率下约可丢多少个 Tap GREAT（绝赞全 CP 口径）；无音符数据为 null。 */
  tapGreatAllowance: number | null;
}

export interface RatingTargetResult {
  current: number;
  target: number;
  targetLabel: string;
  gap: number;
  candidates: RatingTargetCandidate[];
  /** 按推荐顺序贪心组合、精确重算后，最少几张可达目标；前 10 张都达不到时为 null。 */
  minCharts: number | null;
  /** 贪心组合采用的谱面 key（顺序即推荐顺序）。 */
  plannedKeys: string[];
}

export interface RatingTargetOptions {
  isInPlan?: (songId: string, difficultyIndex: number, musicType: 'SD' | 'DX') => boolean;
  /** 返回候选数量上限（默认 30）。 */
  limit?: number;
  /** 覆盖目标分（测试与「自选目标」用）。 */
  targetOverride?: number;
}

function keyOf(songId: string, type: string, difficultyIndex: number): string {
  return `${type}:${songId}:${difficultyIndex}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function tapGreatAllowance(music: MusicData, difficultyIndex: number, target: number): number | null {
  const notes = music.charts[difficultyIndex]?.notes;
  if (!notes || notes.length < 4) return null;
  const isDx = music.type === 'DX' && notes.length >= 5;
  const loss = computeAchievementLoss({
    tap: notes[0],
    hold: notes[1],
    slide: notes[2],
    touch: isDx ? notes[3] : 0,
    breaks: isDx ? notes[4] : notes[3],
  });
  if (!loss.tapGreatUnit) return null;
  return Math.max(0, Math.floor((101 - target) / loss.tapGreatUnit));
}

export function computeRatingTarget(
  rawData: MusicData[],
  scores: PlayerScore[],
  options: RatingTargetOptions = {},
): RatingTargetResult {
  const limit = options.limit ?? 30;
  const b50 = computeB50(rawData, scores);
  const current = b50.total;
  const next = options.targetOverride !== undefined
    ? { target: options.targetOverride, label: String(options.targetOverride) }
    : getNextRatingTarget(current);
  const gap = Math.max(0, next.target - current);
  const empty: RatingTargetResult = { current, target: next.target, targetLabel: next.label, gap, candidates: [], minCharts: gap === 0 ? 0 : null, plannedKeys: [] };
  if (gap === 0) return empty;

  const newEntries = b50.entries.filter(entry => entry.pool === 'new');
  const oldEntries = b50.entries.filter(entry => entry.pool === 'old');
  const newFloor = b50.newFull ? Math.min(...newEntries.map(entry => entry.rating)) : 0;
  const oldFloor = b50.oldFull ? Math.min(...oldEntries.map(entry => entry.rating)) : 0;
  const b50ByKey = new Map(b50.entries.map(entry => [keyOf(entry.songId, entry.musicType, entry.difficultyIndex), entry]));
  const b50Ds = b50.entries.map(entry => entry.ds);
  const dsMedian = median(b50Ds);
  const dsMin = b50Ds.length > 0 ? Math.min(...b50Ds) - 0.2 : 0;
  const dsMax = b50Ds.length > 0 ? Math.max(...b50Ds) + 0.6 : 15;
  const scoreByKey = new Map(scores.map(score => [keyOf(score.songId, score.type, score.difficultyIndex), score]));
  const musicById = new Map(rawData.map(music => [`${music.type}:${music.id}`, music]));
  const comfortDs = Math.max(
    0,
    ...scores
      .filter(score => score.achievement >= 99.5)
      .map(score => {
        const music = musicById.get(`${score.type}:${score.songId}`);
        return music ? getOfficialChartConstant(music, score.difficultyIndex) ?? 0 : 0;
      }),
  ) + 0.3;

  const rough: RatingTargetCandidate[] = [];
  for (const music of rawData) {
    const chartCount = Math.min(music.charts.length, music.ds.length);
    const isNew = Boolean(music.basic_info?.is_new);
    for (let difficultyIndex = 0; difficultyIndex < chartCount; difficultyIndex += 1) {
      const ds = getOfficialChartConstant(music, difficultyIndex);
      if (ds === null || ds <= 0 || ds < dsMin || ds > dsMax) continue;
      const key = keyOf(music.id, music.type, difficultyIndex);
      const score = scoreByKey.get(key);
      const achievement = score?.achievement ?? null;
      if (achievement !== null && achievement >= 100.5) continue;
      if (achievement === null && ds > comfortDs) continue;
      const entry = b50ByKey.get(key);
      const currentRating = achievement === null ? 0 : (calculateRating(ds, achievement) ?? 0);
      const floor = isNew ? newFloor : oldFloor;
      for (const checkpoint of TARGET_CHECKPOINTS) {
        if (achievement !== null && checkpoint <= achievement) continue;
        if (achievement !== null && checkpoint - achievement > MAX_ACHIEVEMENT_JUMP) break;
        const targetRating = calculateRating(ds, checkpoint) ?? 0;
        const gain = entry ? targetRating - entry.rating : Math.max(0, targetRating - floor);
        if (gain <= 0) continue;
        rough.push({
          key,
          songId: music.id,
          musicType: music.type,
          difficultyIndex,
          title: music.title,
          ds,
          pool: isNew ? 'new' : 'old',
          currentAchievement: achievement,
          targetAchievement: checkpoint,
          currentRating,
          targetRating,
          gain,
          inB50: Boolean(entry),
          inPlan: options.isInPlan?.(music.id, difficultyIndex, music.type) ?? false,
          tapGreatAllowance: null,
        });
        break; // 每张谱面只取能涨分的最低一档。
      }
    }
  }

  const order = (left: RatingTargetCandidate, right: RatingTargetCandidate) =>
    right.gain - left.gain
    || Math.abs(left.ds - dsMedian) - Math.abs(right.ds - dsMedian)
    || (left.targetAchievement - (left.currentAchievement ?? 0)) - (right.targetAchievement - (right.currentAchievement ?? 0))
    || left.key.localeCompare(right.key);
  rough.sort(order);

  // 精确复核前 limit×2 名：与 computeB50Gain（计划卡片口径）结果相同，但用池头增量算，
  // 不再每张谱面整体重算一次 B50（回归脚本逐条对拍 computeB50Gain）。
  const pools = buildB50Candidates(rawData, scores);
  const headOf = (isNew: boolean, size: number) => pools
    .filter(candidate => candidate.isNew === isNew)
    .map(candidate => ({ key: keyOf(candidate.songId, candidate.musicType, candidate.difficultyIndex), rating: candidate.rating }))
    .sort((left, right) => right.rating - left.rating)
    .slice(0, size + 1);
  const newHead = headOf(true, B15_SIZE);
  const oldHead = headOf(false, B35_SIZE);
  const exactGain = (candidate: RatingTargetCandidate): number => {
    const isNew = candidate.pool === 'new';
    const size = isNew ? B15_SIZE : B35_SIZE;
    const poolSum = isNew ? b50.newSum : b50.oldSum;
    const ratings = (isNew ? newHead : oldHead).filter(entry => entry.key !== candidate.key).map(entry => entry.rating);
    ratings.push(candidate.targetRating);
    ratings.sort((left, right) => right - left);
    let sum = 0;
    for (let index = 0; index < Math.min(size, ratings.length); index += 1) sum += ratings[index];
    return sum - poolSum;
  };
  const exact = rough.slice(0, limit * 2).map(candidate => {
    const gain = exactGain(candidate);
    const music = musicById.get(`${candidate.musicType}:${candidate.songId}`);
    return { ...candidate, gain, tapGreatAllowance: music ? tapGreatAllowance(music, candidate.difficultyIndex, candidate.targetAchievement) : null };
  }).filter(candidate => candidate.gain > 0);
  exact.sort(order);
  const candidates = exact.slice(0, limit);

  // 贪心组合：按推荐顺序逐张替换成目标成绩，精确重算总分，最多 10 张。
  let working = scores;
  const plannedKeys: string[] = [];
  let minCharts: number | null = null;
  for (const candidate of candidates.slice(0, 10)) {
    working = [
      ...working.filter(score => keyOf(score.songId, score.type, score.difficultyIndex) !== candidate.key),
      { songId: candidate.songId, type: candidate.musicType, difficultyIndex: candidate.difficultyIndex, achievement: candidate.targetAchievement, dxScore: 0, importedAt: 0 } as PlayerScore,
    ];
    plannedKeys.push(candidate.key);
    if (computeB50(rawData, working).total >= next.target) {
      minCharts = plannedKeys.length;
      break;
    }
  }

  return { current, target: next.target, targetLabel: next.label, gap, candidates, minCharts, plannedKeys: minCharts === null ? plannedKeys : plannedKeys.slice(0, minCharts) };
}
