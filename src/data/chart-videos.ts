/**
 * 第三阶段视频目录。
 *
 * 这里故意只放经过人工确认的 Bilibili 记录，不在手机端抓取搜索结果。
 * 后续收到指定 UP 主和 BV 号后，只需把 approved 条目加入此目录即可。
 * 第四阶段的玩家投稿/审核队列不属于本文件。
 */

import type { ChartVideo, ChartVideoDifficulty } from './types';

/** 初始目录为空，避免在没有人工核验时展示错误谱面视频。 */
export const CURATED_CHART_VIDEOS: readonly ChartVideo[] = [];

export function isVideoDifficulty(index: number): index is ChartVideoDifficulty {
  return index === 2 || index === 3 || index === 4;
}

export function getChartVideos(songId: string, difficultyIndex: number): ChartVideo[] {
  if (!isVideoDifficulty(difficultyIndex)) return [];
  return CURATED_CHART_VIDEOS.filter(video => (
    video.status === 'approved'
      && video.songId === songId
      && video.difficultyIndex === difficultyIndex
      && video.platform === 'bilibili'
  ));
}

export function getBilibiliSearchUrl(title: string, difficultyLabel: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${title} ${difficultyLabel} maimai`)}`;
}
