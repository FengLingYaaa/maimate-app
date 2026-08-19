import { getChinaVersionName, isBanquetGenre } from '../constants/game.ts';
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

export function getPlateVersionOptions(entries: PlateEntry[]): string[] {
  return ['全部', ...new Set(entries.map(entry => entry.rawVersion))];
}

export function getPlateChinaVersionOptions(entries: PlateEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.chinaVersion).filter(value => /^舞萌DX\s+20\d{2}$/.test(value)))];
}
