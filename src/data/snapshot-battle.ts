/**
 * 快照对比「推分战报」（v1.15.0）：两份快照的逐曲差异 + 汇总。
 * 纯函数实现，node 回归脚本可直接运行。
 *
 * v1.18.0（快照对比崩溃修复）：旧实现对每条差异行都调用一次
 * computeB50(rawData, 新数组)，新数组让 computeB50 的缓存永远命中不了，
 * 复杂度 O(差异行数 × 全曲库谱面数)，几千条差异在手机上卡死几十秒直至 ANR。
 * 现在 B50 只算一次：每条差异的 B50 影响 = 在所属池（B15/B35）的前 K+1 名里
 * 去掉该谱面、放回旧成绩后重新取前 K 名求和，单行 O(K log K)。
 * 另提供分片异步版本 buildSnapshotBattleReportAsync，供页面在主线程外分批计算。
 */

import type { MusicData, PlayerScore, ScoreSnapshot } from './types';
import { calculateRating } from './rating';
import { B15_SIZE, B35_SIZE, buildB50Candidates, computeB50 } from './b50';
import { serverRaIncrease } from './server-ra';

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
  /** 本地估算：该谱面对 B50 总分的实际影响，不是服务器单谱 RA。 */
  b50Delta: number | null;
  /** 服务端字段 records[].ra 的快照差值；无法判定时为 null。 */
  serverRaDelta: number | null;
  /** 成绩率是否变化，用于区分“达成率改进”与仅服务器计分变化。 */
  achievementChanged: boolean;
  kind: 'added' | 'removed' | 'changed';
}

export interface SnapshotBattleReport {
  rows: SnapshotBattleRow[];
  /** 新增谱面数。 */
  addedCount: number;
  /** 上分谱面数（达成率变化且非新增）。 */
  changedCount: number;
  /** 达成率未变化、但服务端单谱 RA 字段变化的谱面数。 */
  serverRaOnlyCount: number;
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

interface PoolEntry {
  chartKey: string;
  rating: number;
}

/**
 * 增量 B50 影响计算器：B50 只算一次，之后每条差异 O(K log K)。
 * 结果与「把该谱面换回旧成绩（无旧成绩则移除）后整体重算 computeB50」完全一致。
 */
export function createB50ImpactCalculator(rawData: MusicData[], targetScores: PlayerScore[]) {
  const musicByKey = new Map(rawData.map(music => [`${music.id}:${music.type}`, music]));
  const currentB50 = computeB50(rawData, targetScores);
  const candidates = buildB50Candidates(rawData, targetScores);
  const toEntry = (candidate: { songId: string; musicType: string; difficultyIndex: number; rating: number }): PoolEntry => ({
    chartKey: `${candidate.songId}:${candidate.musicType}:${candidate.difficultyIndex}`,
    rating: candidate.rating,
  });
  const byRatingDesc = (left: PoolEntry, right: PoolEntry) => right.rating - left.rating;
  const newHead = candidates.filter(candidate => candidate.isNew).map(toEntry).sort(byRatingDesc).slice(0, B15_SIZE + 1);
  const oldHead = candidates.filter(candidate => !candidate.isNew).map(toEntry).sort(byRatingDesc).slice(0, B35_SIZE + 1);

  /** 与 b50.ts buildCandidates 相同的入选条件。 */
  const candidateRating = (score: PlayerScore | null): number | null => {
    if (!score) return null;
    const music = musicByKey.get(`${score.songId}:${score.type}`);
    if (!music || score.difficultyIndex < 0 || score.difficultyIndex >= music.charts.length) return null;
    const ds = music.ds[score.difficultyIndex];
    if (!Number.isFinite(ds) || ds <= 0) return null;
    if (!Number.isFinite(score.achievement) || score.achievement <= 0) return null;
    const rating = calculateRating(ds, score.achievement);
    return rating === null || rating <= 0 ? null : rating;
  };

  /** 把 chartKey 这张谱面换回 baseScore（null 则移除）后，B50 总分比当前少多少。 */
  const impactOf = (chartKey: string, baseScore: PlayerScore | null): number => {
    const [songId, musicType] = chartKey.split(':');
    const music = musicByKey.get(`${songId}:${musicType}`);
    if (!music) return 0;
    const isNew = Boolean(music.basic_info?.is_new);
    const head = isNew ? newHead : oldHead;
    const size = isNew ? B15_SIZE : B35_SIZE;
    const poolSum = isNew ? currentB50.newSum : currentB50.oldSum;
    const reverted = head.filter(entry => entry.chartKey !== chartKey).map(entry => entry.rating);
    const baseRating = candidateRating(baseScore);
    if (baseRating !== null) reverted.push(baseRating);
    reverted.sort((left, right) => right - left);
    let revertedPoolSum = 0;
    for (let index = 0; index < Math.min(size, reverted.length); index += 1) revertedPoolSum += reverted[index];
    return poolSum - revertedPoolSum;
  };

  return { musicByKey, currentTotal: currentB50.total, impactOf };
}

interface ReportBuilder {
  keys: string[];
  processKey: (key: string) => void;
  finish: () => SnapshotBattleReport;
}

function createReportBuilder(base: ScoreSnapshot, target: ScoreSnapshot, rawData: MusicData[]): ReportBuilder {
  const keyOf = (score: PlayerScore) => `${score.songId}:${score.type}:${score.difficultyIndex}`;
  const baseMap = new Map(base.scores.map(score => [keyOf(score), score]));
  const targetMap = new Map(target.scores.map(score => [keyOf(score), score]));
  // v1.16.5：行内 RA 数值 = 该曲成绩单独对 B50 总分的影响。
  // 口径：B50 总分（含此曲新成绩）− B50 总分（把这首曲替换回旧成绩，新增行则移除）。
  // v1.18.0：改为增量计算，B50 只算一次。
  const { musicByKey, impactOf } = createB50ImpactCalculator(rawData, target.scores);

  const rows: SnapshotBattleRow[] = [];
  let addedCount = 0;
  let changedCount = 0;
  let serverRaOnlyCount = 0;
  let removedCount = 0;
  let totalRatingDelta = 0;

  const processKey = (key: string) => {
    const before = baseMap.get(key) ?? null;
    const after = targetMap.get(key) ?? null;
    if (before && after) {
      const reportedServerRaDelta = serverRaIncrease(before, after);
      if (before.achievement === after.achievement && (reportedServerRaDelta === null || reportedServerRaDelta === 0)) return;
      const beforeRating = ratingOf(musicByKey, before);
      const afterRating = ratingOf(musicByKey, after);
      const ratingDelta = beforeRating !== null && afterRating !== null ? afterRating - beforeRating : null;
      if (ratingDelta !== null) totalRatingDelta += ratingDelta;
      if (before.achievement !== after.achievement) changedCount += 1;
      else serverRaOnlyCount += 1;
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
        b50Delta: impactOf(key, before),
        serverRaDelta: reportedServerRaDelta,
        achievementChanged: before.achievement !== after.achievement,
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
        b50Delta: impactOf(key, null),
        serverRaDelta: serverRaIncrease(null, after),
        achievementChanged: true,
        kind: 'added',
      });
    } else if (before) {
      const beforeRating = ratingOf(musicByKey, before);
      if (beforeRating !== null) totalRatingDelta -= beforeRating;
      removedCount += 1;
      const music = musicByKey.get(`${before.songId}:${before.type}`);
      rows.push({
        chartKey: key,
        songId: before.songId,
        title: music?.title ?? before.title ?? before.songId,
        musicType: before.type,
        difficultyIndex: before.difficultyIndex,
        before: before.achievement,
        after: null,
        ratingDelta: beforeRating !== null ? -beforeRating : null,
        afterRating: null,
        b50Delta: null,
        serverRaDelta: null,
        achievementChanged: true,
        kind: 'removed',
      });
    }
  };

  const finish = (): SnapshotBattleReport => {
    // v1.17.0：排序改为「对 B50 有实际加分（b50Delta>0）的曲目置顶」，内部按 b50Delta 降序；
    // 再按单曲 RA 变化（ratingDelta）降序；removed（b50Delta 恒 null）沉底。
    rows.sort((left, right) =>
      Number((right.b50Delta ?? 0) > 0) - Number((left.b50Delta ?? 0) > 0)
      || (right.b50Delta ?? 0) - (left.b50Delta ?? 0)
      || (right.ratingDelta ?? 0) - (left.ratingDelta ?? 0));
    return { rows, addedCount, changedCount, serverRaOnlyCount, removedCount, totalRatingDelta };
  };

  return { keys: [...new Set([...baseMap.keys(), ...targetMap.keys()])], processKey, finish };
}

/** 计算两份快照的推分战报（同步版本）。musicList 用于联表曲名/曲绘/定数。 */
export function buildSnapshotBattleReport(
  base: ScoreSnapshot,
  target: ScoreSnapshot,
  rawData: MusicData[],
): SnapshotBattleReport {
  const builder = createReportBuilder(base, target, rawData);
  for (const key of builder.keys) builder.processKey(key);
  return builder.finish();
}

/** 默认让出方式：setTimeout(0) 宏任务，RN 下能真正让出一帧给 UI。 */
const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * v1.18.0：分片异步版本——每处理 chunkSize 个谱面让出一次主线程，
 * 差异再多也不会长时间阻塞 UI。isCancelled 返回 true 时提前结束并返回 null。
 */
export async function buildSnapshotBattleReportAsync(
  base: ScoreSnapshot,
  target: ScoreSnapshot,
  rawData: MusicData[],
  options: { chunkSize?: number; yieldFn?: () => Promise<void>; isCancelled?: () => boolean } = {},
): Promise<SnapshotBattleReport | null> {
  const chunkSize = Math.max(50, options.chunkSize ?? 400);
  const yieldFn = options.yieldFn ?? yieldToUi;
  await yieldFn();
  if (options.isCancelled?.()) return null;
  const builder = createReportBuilder(base, target, rawData);
  for (let start = 0; start < builder.keys.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, builder.keys.length);
    for (let index = start; index < end; index += 1) builder.processKey(builder.keys[index]);
    await yieldFn();
    if (options.isCancelled?.()) return null;
  }
  return builder.finish();
}
