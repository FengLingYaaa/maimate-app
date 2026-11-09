/**
 * v1.19.0 定数变更检测（纯函数，node 可测）。
 *
 * 流程：曲库加载/更新 → 与上一次保存的定数基线 diff（levelChanges）→ 只保留对用户 B50 有影响的变更
 * （变更前或变更后在 B50 内，或单曲 Rating 距 B50 门槛 ≤ NEAR_THRESHOLD）→ 在 B50 页显示提醒卡片。
 * 新曲加入、旧曲下架单独统计：下架的曲若在 B50 内也算影响。
 */

import { computeB50 } from './b50';
import { calculateRating } from './rating';
import type { MusicData, PlayerScore } from './types';

/** 距 B50 门槛多少 Rating 以内算「接近 B50」。 */
export const NEAR_THRESHOLD = 5;
/** 超过该比例的谱面同时变化视为数据异常：不提醒、不更新基线。 */
export const ANOMALY_RATIO = 0.3;

export interface LevelBaseline {
  /** `${type}:${id}:${difficultyIndex}` → 定数（保留 1 位）。 */
  ds: Record<string, number>;
  /** `${type}:${id}` → 曲名（判断新曲/下架）。 */
  songs: Record<string, string>;
  savedAt: number;
}

export interface LevelChange {
  key: string;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
  oldDs: number;
  newDs: number;
}

export interface LevelDiff {
  levelChanges: LevelChange[];
  addedSongs: Array<{ key: string; title: string }>;
  removedSongs: Array<{ key: string; title: string }>;
  comparedCharts: number;
  anomaly: boolean;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildLevelBaseline(rawData: MusicData[], now = Date.now()): LevelBaseline {
  const ds: Record<string, number> = {};
  const songs: Record<string, string> = {};
  for (const music of rawData) {
    songs[`${music.type}:${music.id}`] = music.title;
    music.ds.forEach((value, index) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) ds[`${music.type}:${music.id}:${index}`] = round1(value);
    });
  }
  return { ds, songs, savedAt: now };
}

export function diffLevels(baseline: LevelBaseline, rawData: MusicData[]): LevelDiff {
  const next = buildLevelBaseline(rawData, baseline.savedAt);
  const levelChanges: LevelChange[] = [];
  let comparedCharts = 0;
  const musicByKey = new Map(rawData.map(music => [`${music.type}:${music.id}`, music]));
  for (const [key, newDs] of Object.entries(next.ds)) {
    const oldDs = baseline.ds[key];
    if (oldDs === undefined) continue;
    comparedCharts += 1;
    if (oldDs === newDs) continue;
    const [musicType, songId, index] = key.split(':');
    const music = musicByKey.get(`${musicType}:${songId}`);
    levelChanges.push({ key, songId, musicType: musicType as 'SD' | 'DX', difficultyIndex: Number(index), title: music?.title ?? songId, oldDs, newDs });
  }
  const addedSongs = Object.entries(next.songs).filter(([key]) => !(key in baseline.songs)).map(([key, title]) => ({ key, title }));
  const removedSongs = Object.entries(baseline.songs).filter(([key]) => !(key in next.songs)).map(([key, title]) => ({ key, title }));
  const anomaly = comparedCharts === 0
    ? Object.keys(baseline.ds).length > 0
    : levelChanges.length / comparedCharts > ANOMALY_RATIO;
  return { levelChanges, addedSongs, removedSongs, comparedCharts, anomaly };
}

export interface LevelImpactRow extends LevelChange {
  achievement: number;
  oldRating: number;
  newRating: number;
  inB50Before: boolean;
  inB50After: boolean;
}

export interface LevelImpact {
  rows: LevelImpactRow[];
  b50Before: number;
  b50After: number;
  /** 下架且原本在 B50 内的谱面。 */
  removedInB50: Array<{ key: string; title: string }>;
}

/** 把变更前的定数套回曲库，得到「变更前」视角的曲库。 */
function withOldConstants(rawData: MusicData[], changes: LevelChange[]): MusicData[] {
  if (changes.length === 0) return rawData;
  const bySong = new Map<string, LevelChange[]>();
  for (const change of changes) {
    const songKey = `${change.musicType}:${change.songId}`;
    bySong.set(songKey, [...(bySong.get(songKey) ?? []), change]);
  }
  return rawData.map(music => {
    const list = bySong.get(`${music.type}:${music.id}`);
    if (!list) return music;
    const ds = [...music.ds];
    for (const change of list) ds[change.difficultyIndex] = change.oldDs;
    return { ...music, ds };
  });
}

/**
 * 只保留对用户 B50 有影响的定数变更：用户有成绩，且变更前/后在 B50 内，
 * 或单曲 Rating 距所在池门槛 ≤ NEAR_THRESHOLD。
 */
export function computeLevelImpact(
  rawData: MusicData[],
  scores: PlayerScore[],
  diff: Pick<LevelDiff, 'levelChanges' | 'removedSongs'>,
  baselineTitles: Record<string, string> = {},
): LevelImpact {
  const oldRaw = withOldConstants(rawData, diff.levelChanges);
  const before = computeB50(oldRaw, scores);
  const after = computeB50(rawData, scores);
  const keyOf = (songId: string, type: string, index: number) => `${type}:${songId}:${index}`;
  const beforeKeys = new Set(before.entries.map(entry => keyOf(entry.songId, entry.musicType, entry.difficultyIndex)));
  const afterKeys = new Set(after.entries.map(entry => keyOf(entry.songId, entry.musicType, entry.difficultyIndex)));
  const floorOf = (result: typeof after, pool: 'new' | 'old') => {
    const list = result.entries.filter(entry => entry.pool === pool).map(entry => entry.rating);
    const full = pool === 'new' ? result.newFull : result.oldFull;
    return full && list.length > 0 ? Math.min(...list) : 0;
  };
  const musicByKey = new Map(rawData.map(music => [`${music.type}:${music.id}`, music]));
  const scoreByKey = new Map(scores.map(score => [keyOf(score.songId, score.type, score.difficultyIndex), score]));
  const rows: LevelImpactRow[] = [];
  for (const change of diff.levelChanges) {
    const score = scoreByKey.get(change.key);
    if (!score) continue;
    const oldRating = calculateRating(change.oldDs, score.achievement) ?? 0;
    const newRating = calculateRating(change.newDs, score.achievement) ?? 0;
    const pool = musicByKey.get(`${change.musicType}:${change.songId}`)?.basic_info?.is_new ? 'new' : 'old';
    const inB50Before = beforeKeys.has(change.key);
    const inB50After = afterKeys.has(change.key);
    const near = Math.max(oldRating, newRating) >= Math.min(floorOf(before, pool), floorOf(after, pool)) - NEAR_THRESHOLD;
    if (!inB50Before && !inB50After && !near) continue;
    rows.push({ ...change, achievement: score.achievement, oldRating, newRating, inB50Before, inB50After });
  }
  rows.sort((left, right) => Math.abs(right.newRating - right.oldRating) - Math.abs(left.newRating - left.oldRating) || left.title.localeCompare(right.title));

  // 下架：用基线（变更前）的 B50 判断该曲是否原本在榜。
  const removedInB50 = diff.removedSongs.filter(song => {
    const [type, id] = song.key.split(':');
    return scores.some(score => score.type === type && score.songId === id && beforeKeys.has(keyOf(id, type, score.difficultyIndex)));
  }).map(song => ({ ...song, title: baselineTitles[song.key] ?? song.title }));

  return { rows, b50Before: before.total, b50After: after.total, removedInB50 };
}
