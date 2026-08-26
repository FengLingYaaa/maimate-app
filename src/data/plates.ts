import { ChinaVersionMap, getChinaVersionName, isBanquetGenre } from '../constants/game.ts';
import type { MusicData, PlayerScore } from './types.ts';

export const PLATE_BITS = {
  FC: 1,
  SSS: 2,
  FSD: 4,
  AP: 8,
} as const;

export type PlateBit = keyof typeof PLATE_BITS;

export interface PlateEntry {
  key: string;
  music: MusicData;
  difficultyIndex: number;
  rawVersion: string;
  chinaVersion: string;
  mask: number;
}

export interface PlateSummary {
  total: number;
  counts: Record<PlateBit, number>;
}

function chartKey(score: Pick<PlayerScore, 'songId' | 'type' | 'difficultyIndex'>): string {
  return `${score.type}:${score.songId}:${score.difficultyIndex}`;
}

function normalizeStatus(value: string | undefined): string {
  return (value || '').trim().toLocaleLowerCase().replace(/[+_\-\s]/g, '');
}

export function getPlateMask(score: PlayerScore | undefined): number {
  if (!score) return 0;
  const fc = normalizeStatus(score.fc);
  const fs = normalizeStatus(score.fs);
  let mask = 0;
  if (['fc', 'fcp', 'ap', 'app', 'fullcombo', 'fullcombo+'].includes(fc)) mask |= PLATE_BITS.FC;
  if (score.achievement >= 100) mask |= PLATE_BITS.SSS;
  if (['fsd', 'fsdp', 'fsdx', 'fsdxp'].includes(fs)) mask |= PLATE_BITS.FSD;
  if (['ap', 'app', 'allperfect', 'allperfect+'].includes(fc)) mask |= PLATE_BITS.AP;
  return mask;
}

export function buildPlateEntries(rawData: MusicData[], scores: PlayerScore[]): PlateEntry[] {
  const scoreMap = new Map(scores.map(score => [chartKey(score), score]));
  const entries: PlateEntry[] = [];
  for (const music of rawData) {
    if (isBanquetGenre(music.basic_info.genre)) continue;
    const chartCount = Math.min(music.charts.length, music.level.length);
    for (let difficultyIndex = 0; difficultyIndex < chartCount; difficultyIndex += 1) {
      entries.push({
        key: `${music.type}:${music.id}:${difficultyIndex}`,
        music,
        difficultyIndex,
        rawVersion: music.basic_info.from,
        chinaVersion: getChinaVersionName(music.basic_info.from),
        mask: getPlateMask(scoreMap.get(`${music.type}:${music.id}:${difficultyIndex}`)),
      });
    }
  }
  return entries;
}

export function filterPlateEntries(
  entries: PlateEntry[],
  version: string,
  difficultyIndex?: number,
  chinaVersion?: string,
): PlateEntry[] {
  return entries.filter(entry => {
    if (difficultyIndex !== undefined && entry.difficultyIndex !== difficultyIndex) return false;
    if (chinaVersion && entry.chinaVersion !== chinaVersion) return false;
    if (version && version !== '全部' && entry.rawVersion !== version) return false;
    return true;
  });
}

export function summarizePlates(entries: PlateEntry[]): PlateSummary {
  const counts: Record<PlateBit, number> = { FC: 0, SSS: 0, FSD: 0, AP: 0 };
  for (const entry of entries) {
    for (const [name, bit] of Object.entries(PLATE_BITS) as Array<[PlateBit, number]>) {
      if ((entry.mask & bit) !== 0) counts[name] += 1;
    }
  }
  return { total: entries.length, counts };
}

/** 按难度分别统计牌子进度；difficultyIndex 缺失时归入 -1。 */
export interface DifficultyPlateSummary extends PlateSummary {
  difficultyIndex: number;
}

export function summarizePlatesByDifficulty(entries: PlateEntry[]): DifficultyPlateSummary[] {
  const buckets = new Map<number, PlateEntry[]>();
  for (const entry of entries) {
    const list = buckets.get(entry.difficultyIndex) || [];
    list.push(entry);
    buckets.set(entry.difficultyIndex, list);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([difficultyIndex, bucket]) => ({ difficultyIndex, ...summarizePlates(bucket) }));
}

/**
 * 把同一首歌命中的多个难度合并为一行；每个难度独立展示牌子位。
 * 行内难度按索引升序，便于从 Basic 扫到 Re:MASTER。
 */
export interface MergedPlateRow {
  key: string;
  music: MusicData;
  charts: Array<{ difficultyIndex: number; mask: number; level?: string }>;
}

export function mergePlateRows(entries: PlateEntry[]): MergedPlateRow[] {
  const byMusic = new Map<string, MergedPlateRow>();
  for (const entry of entries) {
    const key = `${entry.music.type}:${entry.music.id}`;
    let row = byMusic.get(key);
    if (!row) {
      row = { key, music: entry.music, charts: [] };
      byMusic.set(key, row);
    }
    row.charts.push({
      difficultyIndex: entry.difficultyIndex,
      mask: entry.mask,
      level: entry.music.level[entry.difficultyIndex],
    });
  }
  for (const row of byMusic.values()) row.charts.sort((left, right) => left.difficultyIndex - right.difficultyIndex);
  return [...byMusic.values()];
}

const LEVEL_INDEX_PATTERN = /^\s*(\d+)/;

/** 解析等级标签的数字部分，如 "14+" → 14；无法解析返回 null。 */
export function parseLevelNumber(level: string | undefined): number | null {
  const match = LEVEL_INDEX_PATTERN.exec(level || '');
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** 当前筛选中达到指定等级下限的谱面条目（用于一键加入推分计划）。 */
export function filterEntriesByMinLevel(entries: PlateEntry[], minLevel: number): PlateEntry[] {
  return entries.filter(entry => {
    const parsed = parseLevelNumber(entry.music.level[entry.difficultyIndex]);
    return parsed !== null && parsed >= minLevel;
  });
}

export function getPlateVersionOptions(entries: PlateEntry[]): string[] {
  return ['全部', ...new Set(entries.map(entry => entry.rawVersion))];
}

/**
 * 牌子页的「原始版本」筛选项只保留 DX 代之前的旧世代版本：
 * DX 代的版本归属由「国区版本」筛选承担，避免两个维度互相重叠
 * 导致组合筛选必然为空（v1.7.0 修复的混用问题）。
 */
export function getPlateLegacyVersionOptions(entries: PlateEntry[]): string[] {
  const legacy = new Set(
    entries
      .map(entry => entry.rawVersion)
      .filter(rawVersion => ChinaVersionMap[rawVersion] === undefined),
  );
  return ['全部', ...[...legacy].sort((left, right) => left.localeCompare(right))];
}

export function getPlateChinaVersionOptions(entries: PlateEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.chinaVersion).filter(value => /^舞萌DX(?:\s+20\d{2})?$/.test(value)))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
}
