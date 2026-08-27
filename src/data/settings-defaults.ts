import type { AppSettings, DetailBoardConfig, DetailBoardId } from './types';

/** 详情页板块默认顺序与折叠：Rating 预估 / 完成率损失默认收起。 */
export const DEFAULT_DETAIL_BOARDS: Record<DetailBoardId, DetailBoardConfig> = {
  rating: { order: 0, collapsed: true },
  achievement: { order: 1, collapsed: true },
  bilibili: { order: 2, collapsed: false },
  platform: { order: 3, collapsed: false },
};

export const DETAIL_BOARD_LABELS: Record<DetailBoardId, string> = {
  rating: 'DX Rating 预估',
  achievement: '完成率损失',
  bilibili: 'B 站搜索 / 手元',
  platform: '音乐平台搜索',
};

export const DEFAULT_SETTINGS: AppSettings = {
  showChinaVersion: true,
  defaultSort: { mode: 'relevance', difficultyIndex: 3 },
  showProjectedRating: true,
  defaultMusicPlatform: 'netease',
  musicAppSearchFirst: true,
  detailBoards: DEFAULT_DETAIL_BOARDS,
};

/** 合并外部/备份中的板块配置：逐板块补齐缺失字段，未知字段忽略。 */
export function mergeDetailBoards(parsed: Partial<AppSettings> | undefined): Record<DetailBoardId, DetailBoardConfig> {
  const result = {} as Record<DetailBoardId, DetailBoardConfig>;
  for (const id of Object.keys(DEFAULT_DETAIL_BOARDS) as DetailBoardId[]) {
    result[id] = { ...DEFAULT_DETAIL_BOARDS[id], ...(parsed?.detailBoards?.[id] || {}) };
  }
  return result;
}
