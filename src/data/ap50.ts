/**
 * AP50（v1.16.9）：达成 AP / AP+ 的谱面按 Rating 取前 50 的榜单。
 *
 * 与 B50 / 拟合 50 的差异：
 * - 只收录 fc ∈ {ap, app} 的成绩（官方口径的 All Perfect / All Perfect+）；
 * - 全库单榜，不分新曲/旧曲池；
 * - 单谱 Rating = floor(ds × achievement/100 × coefficient(achievement))，官方公式；
 * - AP 曲目完成率一律 100.5%+，页面与分享卡不再展示完成率颜色条。
 * 纯函数实现，node 回归脚本可直接运行。
 */

import type { MusicData, PlayerScore } from './types';
import { calculateRating } from './rating';

export const AP50_SIZE = 50;

export interface Ap50Entry {
  /** 排名（1 起，Rating 降序，同分按定数高者靠前）。 */
  rank: number;
  /** 单谱官方 Rating。 */
  rating: number;
  /** 官方定数。 */
  ds: number;
  achievement: number;
  songId: string;
  musicType: 'SD' | 'DX';
  difficultyIndex: number;
  title: string;
}

export interface Ap50Result {
  entries: Ap50Entry[];
  /** 前 50 名 Rating 合计（未满 50 按实际数量求和）。 */
  total: number;
}

/** fc 原始值归一化（与 plates.normalizeStatus 同口径）：小写并去掉 +_- 空格。 */
function normalizeFc(value: string | undefined): string {
  return (value || '').trim().toLocaleLowerCase().replace(/[+_\-\s]/g, '');
}

/** 计算达成 AP50。 */
export function computeAp50(musicList: MusicData[], scores: PlayerScore[]): Ap50Result {
  const byChart = new Map<string, PlayerScore>();
  for (const score of scores) {
    byChart.set(`${score.type}:${score.songId}:${score.difficultyIndex}`, score);
  }

  interface Candidate {
    rating: number;
    ds: number;
    achievement: number;
    songId: string;
    musicType: 'SD' | 'DX';
    difficultyIndex: number;
    title: string;
  }
  const candidates: Candidate[] = [];
  for (const music of musicList) {
    for (let difficultyIndex = 0; difficultyIndex < music.charts.length; difficultyIndex += 1) {
      const ds = music.ds[difficultyIndex];
      if (!Number.isFinite(ds) || ds <= 0) continue;
      const score = byChart.get(`${music.type}:${music.id}:${difficultyIndex}`);
      if (!score || !Number.isFinite(score.achievement) || score.achievement <= 0) continue;
      const fc = normalizeFc(score.fc);
      if (fc !== 'ap' && fc !== 'app') continue;
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
      });
    }
  }

  candidates.sort((left, right) =>
    right.rating - left.rating
    || right.ds - left.ds
    || left.songId.localeCompare(right.songId)
    || left.difficultyIndex - right.difficultyIndex);
  const entries = candidates.slice(0, AP50_SIZE).map((row, index) => ({ ...row, rank: index + 1 }));
  const total = entries.reduce((sum, entry) => sum + entry.rating, 0);
  return { entries, total };
}
