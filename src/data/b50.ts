/**
 * B50（旧曲 B35 + 新曲 B15）本地估算。
 *
 * 口径与 Diving-Fish B50 一致：
 * - 单曲 Rating = floor(ds × achievement/100 × coefficient)，见 rating.ts；
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
  /** 排名（1 起，先新曲池后旧曲池，同分按定数高者靠前）。 */
  rank: number;
  /** 所属池：new=当前版本 B15，old=旧曲 B35。 */
  pool: 'new' | 'old';
  /** 池内排名（1 起）。 */
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
  const candidates: Candidate[] = [];
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

function pickTop(candidates: Candidate[], size: number): Candidate[] {
  return [...candidates]
    .sort((left, right) => right.rating - left.rating || right.ds - left.ds || left.songId.localeCompare(right.songId) || left.difficultyIndex - right.difficultyIndex)
    .slice(0, size);
}

function toEntries(pool: 'new' | 'old', picked: Candidate[]): B50Entry[] {
  return picked.map((candidate, index) => ({
    rank: 0,
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

/** 计算 B50：旧曲 TOP35 + 新曲 TOP15。 */
export function computeB50(musicList: MusicData[], scores: PlayerScore[]): B50Result {
  const candidates = buildCandidates(musicList, scores);
  const newPicked = pickTop(candidates.filter(candidate => candidate.isNew), B15_SIZE);
  const oldPicked = pickTop(candidates.filter(candidate => !candidate.isNew), B35_SIZE);
  const newSum = newPicked.reduce((sum, entry) => sum + entry.rating, 0);
  const oldSum = oldPicked.reduce((sum, entry) => sum + entry.rating, 0);

  // 统一排名：新曲池在前，池内与跨池都按 rating 降序；同分保持池内次序。
  const entries = [...toEntries('new', newPicked), ...toEntries('old', oldPicked)]
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    entries,
    oldSum,
    newSum,
    total: oldSum + newSum,
    oldFull: oldPicked.length >= B35_SIZE,
    newFull: newPicked.length >= B15_SIZE,
  };
}

/** 基于一份历史成绩重算 B50 总分（用于快照趋势）。 */
export function computeB50Total(musicList: MusicData[], scores: PlayerScore[]): number {
  return computeB50(musicList, scores).total;
}
