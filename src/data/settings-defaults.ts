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
  /** v1.15.0：快照默认保留 20 份（v1.13–v1.14 为 6），上限 1000。 */
  snapshotLimit: 20,
  autoSinkAchieved: true,
};

/** 快照保留数量的合法范围（v1.15.0 起默认 20，用户可设至多 1000）。 */
export const SNAPSHOT_LIMIT_MIN = 1;
export const SNAPSHOT_LIMIT_MAX = 1000;

/** 归一化用户输入的快照上限：非法/越界回退默认或边界值。 */
export function normalizeSnapshotLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.snapshotLimit;
  const rounded = Math.round(parsed);
  if (rounded < SNAPSHOT_LIMIT_MIN) return SNAPSHOT_LIMIT_MIN;
  if (rounded > SNAPSHOT_LIMIT_MAX) return SNAPSHOT_LIMIT_MAX;
  return rounded;
}

/** 合并外部/备份中的板块配置：逐板块补齐缺失字段，未知字段忽略。 */
export function mergeDetailBoards(parsed: Partial<AppSettings> | undefined): Record<DetailBoardId, DetailBoardConfig> {
  const result = {} as Record<DetailBoardId, DetailBoardConfig>;
  for (const id of Object.keys(DEFAULT_DETAIL_BOARDS) as DetailBoardId[]) {
    result[id] = { ...DEFAULT_DETAIL_BOARDS[id], ...(parsed?.detailBoards?.[id] || {}) };
  }
  return result;
}
