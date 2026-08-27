/**
 * B50（旧曲 B35 + 新曲 B15）本地计算。
 *
 * 口径与 Diving-Fish B50 完全一致（v1.12.0 起删除「本地估算」措辞）：
 * - 单谱 Rating = floor(ds × achievement/100 × coefficient)，见 rating.ts；
 * - 「新曲」= 当前版本（basic_info.is_new）曲目，取最好 15 张；
 *   其余全部按旧曲池取最好 35 张；
 * - B50 = 旧曲池之和 + 新曲池之和。
 * 纯函数实现，node 回归脚本可直接运行。
 */

import type { MusicData, PlayerScore } from './types';
import { calculateRating } from './rating';

export const B35_SIZE = 35;
export const B15_SIZE = 15;

export interface B50Entry {
  /** 排名（1 起，先新曲池后旧曲池，池内按 rating 降序）。 */
  rank: number;
  /** 所属池：new=当前版本 B15，old=旧曲 B35。 */
  pool: 'new' | 'old';
  /** 普内排名（1 起）。 */
  poolRank: number;
  rating: number;
  ds: number;
  achievement: number;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
}

export interface B50Result {
  entries: B50Entry[];
  /** 旧曲池合计（不足 35 首按实际数量求和）。 */
  oldSum: number;
  /** 新曲池合计（不足 15 首按实际数量求和）。 */
  newSum: number;
  total: number;
  /** 池是否已满（未满时总分偏低，UI 可提示）。 */
  oldFull: boolean;
  newFull: boolean;
  /** v1.12.0：与第 15 名同 Rating 但未入榜的新曲（按定数高者靠前）。 */
  newTies: B50Entry[];
  /** v1.12.0：与第 35 名同 Rating 但未入榜的旧曲（按定数高者靠前）。 */
  oldTies: B50Entry[];
}

interface Candidate {
  rating: number;
  ds: number;
  achievement: number;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  isNew: boolean;
}

function buildCandidates(musicList: MusicData[], scores: PlayerScore[]): Candidate[] {
  const byChart = new Map<string, PlayerScore>();
  for (const score of scores) {
    byChart.set(`${score.type}:${score.songId}:${score.difficultyIndex}`, score);
  }
  const candidates: Candidate[] = []
  for (const music of musicList) {
    const isNew = Boolean(music.basic_info?.is_new);
    for (let difficultyIndex = 0; difficultyIndex < music.charts.length; difficultyIndex += 1) {
      const ds = music.ds[difficultyIndex];
      if (!Number.isFinite(ds) || ds <= 0) continue;
      const score = byChart.get(`${music.type}:${music.id}:${difficultyIndex}`);
      if (!score || !Number.isFinite(score.achievement) || score.achievement <= 0) continue;
      const rating = calculateRating(ds, score.achievement);
      if (rating === null || rating <= 0) continue;
      candidates.push({
        rating,
        ds,
        achievement: score.achievement,
        songId: music.id,
        musicType: music.type,
        difficultyIndex,
        title: music.title,
        isNew,
      });
    }
  }
  return candidates;
}

/** 池内排序：rating 降序，同分按定数高者靠前，再按 ID/难度稳定。 */
function compareCandidates(left: Candidate, right: Candidate): number {
  return right.rating - left.rating
    || right.ds - left.ds
    || left.songId.localeCompare(right.songId)
    || left.difficultyIndex - right.difficultyIndex;
}

function pickTop(candidates: Candidate[], size: number): Candidate[] {
  return [...candidates].sort(compareCandidates).slice(0, size);
}

/** 找出与池末位同 rating 的未入榜曲目（同分按定数高者靠前）。 */
function pickTies(candidates: Candidate[], picked: Candidate[], size: number): Candidate[] {
  if (picked.length < size) return [];
  const lastRating = picked[picked.length - 1].rating;
  const pickedKeys = new Set(picked.map(candidate => `${candidate.musicType}:${candidate.songId}:${candidate.difficultyIndex}`));
  return [...candidates]
    .filter(candidate => candidate.rating === lastRating && !pickedKeys.has(`${candidate.musicType}:${candidate.songId}:${candidate.difficultyIndex}`))
    .sort(compareCandidates);
}

function toEntries(pool: 'new' | 'old', picked: Candidate[], startRank: number): B50Entry[] {
  return picked.map((candidate, index) => ({
    rank: startRank + index,
    pool,
    poolRank: index + 1,
    rating: candidate.rating,
    ds: candidate.ds,
    achievement: candidate.achievement,
    songId: candidate.songId,
    musicType: candidate.musicType,
    difficultyIndex: candidate.difficultyIndex,
    title: candidate.title,
  }));
}

/** 计算 B50：旧曲 TOP35 + 新曲 TOP15，并给出与池末位同分的未入榜曲目。 */
export function computeB50(musicList: MusicData[], scores: PlayerScore[]): B50Result {
  const candidates = buildCandidates(musicList, scores);
  const newPicked = pickTop(candidates.filter(candidate => candidate.isNew), B15_SIZE);
  const oldPicked = pickTop(candidates.filter(candidate => !candidate.isNew), B35_SIZE);
  const newSum = newPicked.reduce((sum, entry) => sum + entry.rating, 0);
  const oldSum = oldPicked.reduce((sum, entry) => sum + entry.rating, 0);

  const entries = [...toEntries('new', newPicked, 1), ...toEntries('old', oldPicked, newPicked.length + 1)];

  return {
    entries,
    oldSum,
    newSum,
    total: oldSum + newSum,
    oldFull: oldPicked.length >= B35_SIZE,
    newFull: newPicked.length >= B15_SIZE,
    newTies: toEntries('new', pickTies(candidates.filter(candidate => candidate.isNew), newPicked, B15_SIZE), 0).map(entry => ({ ...entry, rank: 0, poolRank: 0 })),
    oldTies: toEntries('old', pickTies(candidates.filter(candidate => !candidate.isNew), oldPicked, B35_SIZE), 0).map(entry => ({ ...entry, rank: 0, poolRank: 0 })),
  };
}

/**
 * v1.12.0：目标达成增量——把指定谱面的成绩替换为目标达成率后重算 B50，
 * 返回与当前总分的差值。目标无效（非有限正数）返回 null；谱面不在曲库中返回 null。
 */
export function computeB50Gain(
  musicList: MusicData[],
  scores: PlayerScore[],
  chart: { songId: string; musicType: 'SD' | 'DX'; difficultyIndex: number },
  targetAchievement: number,
): number | null {
  if (!Number.isFinite(targetAchievement) || targetAchievement <= 0) return null;
  const target = Math.min(100.5, targetAchievement);
  const music = musicList.find(candidate => candidate.id === chart.songId && candidate.type === chart.musicType);
  if (!music) return null;
  const ds = music.ds[chart.difficultyIndex];
  if (!Number.isFinite(ds) || ds <= 0) return null;

  const replaced: PlayerScore = {
    songId: chart.songId,
    type: chart.musicType,
    difficultyIndex: chart.difficultyIndex,
    achievement: target,
    dxScore: 0,
    importedAt: 0,
  };
  const nextScores = scores.filter(score => !(score.songId === chart.songId
    && score.type === chart.musicType
    && score.difficultyIndex === chart.difficultyIndex));
  nextScores.push(replaced);

  const before = computeB50(musicList, scores).total;
  const after = computeB50(musicList, nextScores).total;
  return after - before;
}
