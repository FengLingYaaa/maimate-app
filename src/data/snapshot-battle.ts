/**
 * 快照对比「推分战报」（v1.15.0）：两份快照的逐曲差异 + 汇总。
 * 纯函数实现，node 回归脚本可直接运行。
 */

import type { MusicData, PlayerScore, ScoreSnapshot } from './types';
import { calculateRating } from './rating';
import { computeB50 } from './b50';

export interface SnapshotBattleRow {
  chartKey: string;
  songId: string;
  title: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  /** 旧达成率（快照缺该谱面时为 null）。 */
  before: number | null;
  /** 新达成率。 */
  after: number | null;
  /** 单谱 Rating 变化（after − before，双方都在时才有值）。 */
  ratingDelta: number | null;
  /** 单谱 Rating 绝对值（新快照的）。 */
  afterRating: number | null;
  /** v1.16.5：该曲成绩单独对 B50 总分的影响（B50 总分差）；0 或不适用为 null（UI 不显示）。 */
  b50Delta: number | null;
  kind: 'added' | 'removed' | 'changed';
}

export interface SnapshotBattleReport {
  rows: SnapshotBattleRow[];
  /** 新增谱面数。 */
  addedCount: number;
  /** 上分谱面数（达成率变化且非新增）。 */
  changedCount: number;
  /** 移除谱面数。 */
  removedCount: number;
  /** 总 Rating 变化（新增+上分+移除合计）。 */
  totalRatingDelta: number;
}

function ratingOf(musicByKey: Map<string, MusicData>, score: PlayerScore): number | null {
  const music = musicByKey.get(`${score.songId}:${score.type}`);
  if (!music) return null;
  return calculateRating(music.ds[score.difficultyIndex], score.achievement);
}

/** 计算两份快照的推分战报。musicList 用于联表曲名/曲绘/定数。 */
export function buildSnapshotBattleReport(
  base: ScoreSnapshot,
  target: ScoreSnapshot,
  rawData: MusicData[],
): SnapshotBattleReport {
  const musicByKey = new Map(rawData.map(music => [`${music.id}:${music.type}`, music]));
  const keyOf = (score: PlayerScore) => `${score.songId}:${score.type}:${score.difficultyIndex}`;
  const baseMap = new Map(base.scores.map(score => [keyOf(score), score]));
  const targetMap = new Map(target.scores.map(score => [keyOf(score), score]));
  // v1.16.5：行内 RA 数值 = 该曲成绩单独对 B50 总分的影响。
  // 口径：B50 总分（含此曲新成绩）− B50 总分（把这首曲替换回旧成绩，新增行则移除）。
  // 现快照成绩不进榜、或替换回旧成绩后总分不变 → 影响 0 → UI 不显示。
  const currentB50 = computeB50(rawData, target.scores);
  const currentTotal = currentB50.total;

  /** 计算把 key 这首曲替换回 base 成绩（无则移除）后的 B50 总分与当前总分之差。 */
  const b50ImpactOf = (key: string, baseScore: PlayerScore | null): number | null => {
    const replaced = target.scores.filter(score => keyOf(score) !== key);
    if (baseScore) replaced.push(baseScore);
    const revertedTotal = computeB50(rawData, replaced).total;
    return currentTotal - revertedTotal;
  };

  const rows: SnapshotBattleRow[] = [];
  let addedCount = 0;
  let changedCount = 0;
  let removedCount = 0;
  let totalRatingDelta = 0;

  const keys = new Set([...baseMap.keys(), ...targetMap.keys()]);
  for (const key of keys) {
    const before = baseMap.get(key) ?? null;
    const after = targetMap.get(key) ?? null;
    if (before && after) {
      if (before.achievement === after.achievement) continue;
      const beforeRating = ratingOf(musicByKey, before);
      const afterRating = ratingOf(musicByKey, after);
      const ratingDelta = beforeRating !== null && afterRating !== null ? afterRating - beforeRating : null;
      if (ratingDelta !== null) totalRatingDelta += ratingDelta;
      changedCount += 1;
      const music = musicByKey.get(`${after.songId}:${after.type}`);
      rows.push({
        chartKey: key,
        songId: after.songId,
        title: music?.title ?? after.title ?? after.songId,
        musicType: after.type,
        difficultyIndex: after.difficultyIndex,
        before: before.achievement,
        after: after.achievement,
        ratingDelta,
        afterRating,
        b50Delta: b50ImpactOf(key, before),
        kind: 'changed',
      });
    } else if (after) {
      const afterRating = ratingOf(musicByKey, after);
      if (afterRating !== null) totalRatingDelta += afterRating;
      addedCount += 1;
      const music = musicByKey.get(`${after.songId}:${after.type}`);
      rows.push({
        chartKey: key,
        songId: after.songId,
        title: music?.title ?? after.title ?? after.songId,
        musicType: after.type,
        difficultyIndex: after.difficultyIndex,
        before: null,
        after: after.achievement,
        ratingDelta: afterRating,
        afterRating,
        b50Delta: b50ImpactOf(key, null),
        kind: 'added',
      });
    } else {
      const beforeRating = ratingOf(musicByKey, before!);
      if (beforeRating !== null) totalRatingDelta -= beforeRating;
      removedCount += 1;
      const music = musicByKey.get(`${before!.songId}:${before!.type}`);
      rows.push({
        chartKey: key,
        songId: before!.songId,
        title: music?.title ?? before!.title ?? before!.songId,
        musicType: before!.type,
        difficultyIndex: before!.difficultyIndex,
        before: before!.achievement,
        after: null,
        ratingDelta: beforeRating !== null ? -beforeRating : null,
        afterRating: null,
        b50Delta: null,
        kind: 'removed',
      });
    }
  }

  rows.sort((left, right) => (right.ratingDelta ?? 0) - (left.ratingDelta ?? 0));
  return { rows, addedCount, changedCount, removedCount, totalRatingDelta };
}
